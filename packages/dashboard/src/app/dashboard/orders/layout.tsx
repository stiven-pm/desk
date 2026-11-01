import { NativeInventoryGate } from "@/components/native-inventory-gate";
import { PwaRegister } from "@/components/pwa-register";

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NativeInventoryGate>
      <PwaRegister />
      {children}
    </NativeInventoryGate>
  );
}
