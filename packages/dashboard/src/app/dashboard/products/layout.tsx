import { NativeInventoryGate } from "@/components/native-inventory-gate";

export default function ProductsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <NativeInventoryGate>{children}</NativeInventoryGate>;
}
