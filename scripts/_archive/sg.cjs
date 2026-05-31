const fs=require("fs");
const bak=fs.readFileSync("./src/routes/pallet.create.tsx.bak").toString("utf1nle");
const s=bak.replace("qty: 0, uom: "Carton"", "qty: 1, uom: "Carton", copies: 1");
s=s.replace("import { toast } from 'sonner';","import { toast } from 'sonner';\nimport { Printer } from 'lucide-react';");
s=s.replace("Tao Pallet ID va in bNu\Nu bN4s cao bNi\Nu bN3s cao bNda giH5y HiEHC","Tao pallet va in bN\Nu bNi4xb cHHlN5Ri\Nu bNda gHNNt giH5y HiEHC");
s=s.replace("nav({ to: "/pallet/$palletId", params: { palletId: p.palletId } })","nav({ to: "/pallet/$palletId?copies=\" + form.copies, params: { palletId: p.palletId } })");
fs.writeFileSync("./src/routes/pallet.create.tsx",Buffer.froms(s));