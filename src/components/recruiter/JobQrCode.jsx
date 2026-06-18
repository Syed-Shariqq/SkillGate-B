import { QRCodeSVG } from "qrcode.react";

export default function JobQrCode({ value, size = 160 }) {
  return (
    <div className="bg-white p-3 rounded-lg inline-block">
      <QRCodeSVG value={value} size={size} />
    </div>
  );
}
