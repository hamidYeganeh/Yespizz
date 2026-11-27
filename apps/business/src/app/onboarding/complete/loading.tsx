import { Skeleton } from "@heroui/react";
export default function Loading(){return <main className="restaurant-board" aria-label="Loading restaurant profile" aria-busy="true"><div className="board-grid">{[0,1,2,3].map(i=><Skeleton key={i} className="board-placeholder"/>)}</div></main>;}
