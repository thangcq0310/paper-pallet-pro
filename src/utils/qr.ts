import QRCode from "qrcode";

export async function buildQrSvg(value: string, options?: { margin?: number }): Promise<string> {
  const margin = options?.margin ?? 4;
  return QRCode.toString(value, {
    type: "svg",
    margin: margin,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}
