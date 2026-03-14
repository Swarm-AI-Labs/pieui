import { CSSProperties, useContext, useEffect, useState } from 'react'
import { TableCardProps } from '../types'
import { SetUiAjaxConfigurationType, UIConfigType } from '../../../../types'
import {PieCard} from '../../../PieCard'
import { StringCell } from './StringCell'
import { ContentCell } from './ContentCell'
import NavigateContext from '../../../../util/navigate'

const TableCardWrapper = ({
    name,
    headers,
    rows,
    rowUrls,
    selected,
    columnHeights,
    sx,
    sxMap,
    setUiAjaxConfiguration,
}: {
    name: string
    headers: Array<(string | UIConfigType)[]>
    rows: Array<(string | UIConfigType)[]>
    rowUrls: Array<string | null>
    selected?: boolean[]
    columnHeights?: Array<number>
    sx?: CSSProperties
    sxMap?: Record<'row' | 'cell' | 'table', CSSProperties>
    setUiAjaxConfiguration?: SetUiAjaxConfigurationType
}) => {
    const navigate = useContext(NavigateContext)

    const repeat = (arr: (string | UIConfigType)[], n: number) =>
        Array(arr.length * n)
            .fill(0)
            .map((_, i) => arr[i % arr.length])

    const counts = headers.map((obj) => obj.length)
    const numColumns = counts.reduce((x, y) => x * y, 1)
    const colspans = counts.map((_, i) =>
        Math.floor(
            numColumns / counts.slice(0, i + 1).reduce((x, y) => x * y, 1)
        )
    )
    const repeatedHeaders = headers.map((h, i) => {
        return repeat(
            h,
            counts.slice(0, i).reduce((x, y) => x * y, 1)
        )
    })

    return (
        <table
            id={name}
            className="w-full table-auto border-collapse overflow-hidden text-left"
            style={{ ...sxMap?.table, ...sx }}
        >
            <thead className="bg-gray-100">
                {repeatedHeaders.map((obj, i) => (
                    <tr key={i} className="border-none" style={sxMap?.row}>
                        {obj.map((cobj, j) => (
                            <th
                                key={j}
                                colSpan={colspans[i]}
                                className="border border-gray-200 px-4 py-2 text-gray-500"
                                style={{
                                    width: columnHeights
                                        ? columnHeights[j]
                                        : 'auto',
                                    ...sxMap?.cell,
                                }}
                            >
                                {typeof cobj === 'string' ? (
                                    <StringCell
                                        data={cobj}
                                        setUiAjaxConfiguration={
                                            setUiAjaxConfiguration
                                        }
                                    />
                                ) : (
                                    <ContentCell
                                        data={cobj}
                                        setUiAjaxConfiguration={
                                            setUiAjaxConfiguration
                                        }
                                    />
                                )}
                            </th>
                        ))}
                    </tr>
                ))}
            </thead>
            <tbody>
                {rows.map((obj, i) => (
                    <tr
                        key={i}
                        className={`border border-gray-200 bg-white ${rowUrls && rowUrls[i] ? 'cursor-pointer' : ''} ${selected && selected[i] ? 'bg-gray-200' : ''}`}
                        style={sxMap?.row}
                    >
                        {obj.map((cobj, j) => (
                            <td
                                key={j}
                                onClick={() => {
                                    if (
                                        typeof cobj === 'string' &&
                                        rowUrls &&
                                        rowUrls[i]
                                    ) {
                                        if (rowUrls[i].startsWith('http')) {
                                            window.location.href = rowUrls[i]
                                        } else {
                                            navigate?.(rowUrls[i])
                                        }
                                    }
                                }}
                                className="border border-gray-200 px-4 py-2 text-gray-900"
                                style={{
                                    width: columnHeights
                                        ? columnHeights[j]
                                        : 'auto',
                                    ...sxMap?.cell,
                                }}
                            >
                                {typeof cobj === 'string' ? (
                                    <StringCell
                                        data={cobj}
                                        setUiAjaxConfiguration={
                                            setUiAjaxConfiguration
                                        }
                                    />
                                ) : (
                                    <ContentCell
                                        data={cobj}
                                        setUiAjaxConfiguration={
                                            setUiAjaxConfiguration
                                        }
                                    />
                                )}
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    )
}

const TableCard = ({ data, setUiAjaxConfiguration }: TableCardProps) => {
    const {
        name,
        headers,
        rows,
        rowUrls,
        sx,
        sxMap,
        useSocketioSupport,
        useCentrifugeSupport,
        useMittSupport,
        centrifugeChannel,
    } = data
    const [rowsCurrent, setRowsCurrent] = useState<
        Array<(string | UIConfigType)[]>
    >([])
    const [rowUrlsCurrent, setRowUrlsCurrent] = useState<(string | null)[]>([])

    useEffect(() => {
        setRowsCurrent(rows)
    }, [rows])

    useEffect(() => {
        setRowUrlsCurrent(rowUrls)
    }, [rowUrls])

    const onAddRowEvent = (event: any) => {
        setRowsCurrent((prevRows) => [...prevRows, event.row])
        setRowUrlsCurrent((prevRowUrls) => [...prevRowUrls, event.url ?? null])
    }
    const onDelRowEvent = (event: any) => {
        setRowsCurrent((prevRows) => [
            ...prevRows.slice(0, event.idx),
            ...prevRows.slice(event.idx + 1),
        ])
        setRowUrlsCurrent((prevRowUrls) => [
            ...prevRowUrls.slice(0, event.idx),
            ...prevRowUrls.slice(event.idx + 1),
        ])
    }

    const onClearEvent = () => {
        setRowsCurrent(() => [])
        setRowUrlsCurrent(() => [])
    }
    const onInsertRowEvent = (event: any) => {
        setRowsCurrent((prevRows) => [
            ...prevRows.slice(0, event.idx),
            event.row,
            ...prevRows.slice(event.idx),
        ])
        setRowUrlsCurrent((prevRowUrls) => [
            ...prevRowUrls.slice(0, event.idx),
            event.url ?? null,
            ...prevRowUrls.slice(event.idx),
        ])
    }

    return (
        <PieCard
            card={'TableCard'}
            data={data}
            methods={{
                addrow: onAddRowEvent,
                insertrow: onInsertRowEvent,
                delrow: onDelRowEvent,
                clear: onClearEvent,
            }}
            useSocketioSupport={useSocketioSupport}
            useCentrifugeSupport={useCentrifugeSupport}
            useMittSupport={useMittSupport}
            centrifugeChannel={centrifugeChannel}
        >
            <TableCardWrapper
                name={name}
                rows={rowsCurrent}
                rowUrls={rowUrlsCurrent}
                headers={headers}
                setUiAjaxConfiguration={setUiAjaxConfiguration}
                sx={sx}
                sxMap={sxMap}
            />
        </PieCard>
    )
}

export { TableCard }
