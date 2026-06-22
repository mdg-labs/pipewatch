import { Button } from "@pipewatch/ui";

export interface StubCtaButtonProps {
  label: string;
}

export function StubCtaButton({ label }: StubCtaButtonProps) {
  return <Button type="button">{label}</Button>;
}
