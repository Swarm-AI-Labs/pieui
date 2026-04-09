export const componentIndexTemplate = (componentName: string): string =>
    `import { registerPieComponent } from "@piedata/pieui";
import ${componentName} from "./ui/${componentName}";

export default registerPieComponent({
  name: "${componentName}",
  component: ${componentName},
});
`
