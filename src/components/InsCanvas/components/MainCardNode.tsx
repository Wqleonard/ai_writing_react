import React from "react";
import { useEdges } from "@xyflow/react";
import MainCard from "./MainCard";

/**
 * Wrapper that injects children from edges into MainCard.
 * MainCard needs to know if it has children to show/hide the Handle.
 */
export default function MainCardNode(props: any) {
  const edges = useEdges();
  const children = React.useMemo(() => {
    const outgoing = edges.filter((e: any) => e.source === props.id);
    return outgoing.map((e: any) => e.target);
  }, [edges, props.id]);

  return (
    <MainCard
      {...props}
      data={{
        ...props.data,
        children,
      } as any}
    />
  );
}
