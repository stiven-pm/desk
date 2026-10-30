import { NativeInventoryGate } from "@/components/native-inventory-gate";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NativeInventoryGate>{children}</NativeInventoryGate>;
}
