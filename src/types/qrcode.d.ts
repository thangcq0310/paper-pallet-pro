declare module "qrcode" {
  interface ToStringOptions {
    type?: "svg" | "terminal" | "utf8" | "png";
    margin?: number;
    width?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  const QRCode: {
    toString(value: string, options?: ToStringOptions): Promise<string>;
  };

  export default QRCode;
}
