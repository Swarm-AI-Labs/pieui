export const componentIndexTemplate = (componentName: string): string =>
    `import { registerPieComponent } from "@swarm.ing/pieui";
import ${componentName} from "./ui/${componentName}";

export default registerPieComponent({
  name: "${componentName}",
  component: ${componentName},
});
`
