import {notFound} from "next/navigation";
import {sections} from "../../../../../../packages/ui/src/workspace-data";
import {OperationsWorkspace} from "../../../../../../packages/ui/src/operations-workspace";
import "../../../../../../packages/ui/styles/workspace.css";
export default async function Page({params}:{params:Promise<{path:string[]}>}){const {path}=await params;const page=["Dispatch map",...Object.keys(sections)].find(n=>n.toLowerCase().replaceAll(" ","-")===path[0]);if(!page||path.length>2||sections[page]&&!sections[page]?.business)notFound();return <OperationsWorkspace key={path.join("/")} start={page} detail={path[1]} business/>}
