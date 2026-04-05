export const registerCallTemplate = (componentName: string): string =>
    `    registerPieComponent({
        name: '${componentName}',
        component: ${componentName},
    });`
