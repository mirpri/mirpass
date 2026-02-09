import { Skeleton } from "antd";

export function LoadingView() {
  return (
    <div className="max-w-lg w-full p-6">
      <Skeleton active />
    </div>
  );
}