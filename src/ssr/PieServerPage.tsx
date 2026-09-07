import * as React from 'react'
// Рут импортируется ПО ИМЕНИ ПАКЕТА, а не относительным путём. Сборка ssr-входа
// инлайнит всё внутреннее, и вместе с рутом сюда попал бы его код — уже без
// директивы `"use client"`, которую вешает баннер на главный вход. Next счёл бы
// рут серверным и упал бы на первом же хуке. По имени пакета импорт остаётся
// внешним, и граница клиента сохраняется.
import { PieRoot } from '@swarm.ing/pieui'
import { PieTelegramRoot } from '@swarm.ing/pieui/telegram'
import { PieMaxRoot } from '@swarm.ing/pieui/max'

import { loadPieConfig } from '../util/loadPieConfig'
import { preloadComponent } from '../util/registry'
import type { PieConfig } from '../types'
import type { PieRootKind } from '../util/contentRequest'

export interface PieServerPageProps {
    /** Runtime-конфигурация: адреса API и Centrifuge, логи. */
    config: PieConfig
    /** Маршрут страницы, как его знает бэкенд: `/prime/report`. */
    pathname: string
    /** Строка запроса БЕЗ ведущего «?» — например `slug=abc`. */
    search?: string
    /**
     * Каким рутом гидрировать страницу на клиенте. По умолчанию `web`.
     *
     * Сервер ходит за конфигом ВСЕГДА как `web`: конфиг мини-аппа зависит от
     * `initData`, а он существует только внутри клиента Telegram или MAX, и на
     * сервере запрос от имени пользователя собрать не из чего.
     *
     * Поэтому `telegram` и `max` здесь означают гибрид: сервер отдаёт гостевую
     * версию страницы — она одинакова для всех и годится и роботу, и первому
     * кадру внутри мини-аппа, — а на клиенте встаёт нужный рут, дожидается
     * `initData` и перезапрашивает конфиг уже от имени пользователя.
     *
     * Гибрид работает там, где гостевой ответ осмыслен: публичный разбор по
     * ссылке, витрина, лендинг. Для экрана вроде `/chat` смысла нет — без
     * `initData` бэкенду нечего отдать.
     */
    clientRoot?: Extract<PieRootKind, 'web' | 'telegram' | 'max'>
    /**
     * Сколько секунд держать ответ в кэше Next. `false` — не кэшировать вовсе.
     * По умолчанию кэш не трогается: решает хост.
     */
    revalidate?: number | false
    /** Что показать, если запрос конфига упал. Без него ошибка пробрасывается. */
    fallback?: React.ReactNode
    /** Снимок конфигов по маршрутам — тот же, что у клиентских рутов. */
    piecache?: Record<string, unknown>
}

/**
 * Страница pie, отрисованная НА СЕРВЕРЕ.
 *
 * Обычный рут просит конфиг из хука, то есть уже после гидрации: в HTML, что
 * отдал сервер, страницы нет — пустой контейнер и скелет. Человеку это стоит
 * лишнего похода в сеть, поисковому роботу — всей страницы.
 *
 * Этот компонент берёт конфиг сам, до рендера, и отдаёт руту готовым. Хосту
 * остаётся одна строка:
 *
 * ```tsx
 * // app/prime/report/[slug]/page.tsx — без 'use client'
 * export default async function Page({ params }) {
 *     const { slug } = await params
 *     return (
 *         <PieServerPage
 *             config={{ apiServer: process.env.PIE_API_SERVER! }}
 *             pathname="/prime/report"
 *             search={new URLSearchParams({ slug }).toString()}
 *             revalidate={300}
 *         />
 *     )
 * }
 * ```
 *
 * Годится для страниц, одинаковых для всех: публичные разборы по ссылке,
 * витрины, лендинги. Экран мини-аппа так не отрисовать — его конфиг зависит от
 * `initData`, которого на сервере нет.
 */
/**
 * Имена карточек, встречающихся в конфиге.
 *
 * Обход общий, по всему дереву: форма конфига — забота бэкенда, а `content`
 * бывает и одним узлом, и списком, и словарём узлов.
 */
function cardNames(config: unknown): string[] {
    const names = new Set<string>()
    const stack: unknown[] = [config]

    while (stack.length) {
        const node = stack.pop()
        if (!node || typeof node !== 'object') continue
        if (Array.isArray(node)) {
            stack.push(...node)
            continue
        }
        const record = node as Record<string, unknown>
        if (typeof record.card === 'string') names.add(record.card)
        stack.push(...Object.values(record))
    }
    return Array.from(names)
}

export default async function PieServerPage({
    config,
    pathname,
    search = '',
    clientRoot = 'web',
    revalidate,
    fallback,
    piecache,
}: PieServerPageProps) {
    let initialConfig
    try {
        initialConfig = await loadPieConfig({
            apiServer: config.apiServer,
            pathname,
            search,
            // Гостевой конфиг: `initData` на сервере нет по определению.
            root: 'web',
            requestInit:
                revalidate === undefined
                    ? undefined
                    : revalidate === false
                      ? { cache: 'no-store' }
                      : { next: { revalidate } },
        })
    } catch (error) {
        // Без запасного узла ошибку видит страница: показать 404 или упасть —
        // её решение. Молча отдать пустую разметку значило бы ответить роботу
        // кодом 200 на несуществующий разбор.
        if (fallback === undefined) throw error
        return <>{fallback}</>
    }

    // Прогрев чанков ПЕРЕД рендером. Карточки регистрируются лениво
    // (`React.lazy`), и на сервере нерасхоложенный `lazy` отдаёт заглушку
    // Suspense: HTML уходит со скелетом вместо страницы — то есть ровно с тем,
    // ради чего серверный рендер и затевался, только теперь ещё и дороже.
    //
    // Реестр — глобальный синглтон, поэтому карточки должен зарегистрировать
    // сам хост: серверный компонент, рендерящий эту страницу, обязан
    // импортировать свой реестр. Для незарегистрированных имён прогрев ничего
    // не делает, и такая карточка честно приедет на клиенте.
    await Promise.all(
        cardNames(initialConfig).map((name) =>
            // Сбой одного чанка не должен ронять страницу: эта карточка
            // догрузится на клиенте, остальные отрисуются сервером.
            preloadComponent(name)?.catch(() => undefined),
        ),
    )

    const Root =
        clientRoot === 'telegram'
            ? PieTelegramRoot
            : clientRoot === 'max'
              ? PieMaxRoot
              : PieRoot

    return (
        <Root
            config={config}
            location={{ pathname, search }}
            initialConfig={initialConfig}
            fallback={fallback}
            piecache={piecache as never}
            // Мини-апп догружает СВОЙ конфиг: серверный отдан без `initData`,
            // то есть без лайков, владения и всего, что зависит от человека.
            // Первый кадр от этого не страдает — он уже на экране.
            queryOptions={
                clientRoot === 'web'
                    ? undefined
                    : { staleTime: 0, refetchOnMount: 'always' }
            }
        />
    )
}
