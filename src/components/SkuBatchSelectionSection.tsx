import type { ReactNode } from "react";
import type { SKU } from "@/types";
import type { AvailableBatchSummary, AvailableSkuSummary } from "@/services/taskQueryService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SkuBatchSearchPanel } from "@/components/SkuBatchSearchPanel";

export function SkuBatchSelectionSection(props: {
  title: string;
  purposeLabel: "MOVE" | "PICK";
  skus: SKU[];
  availableSkuSummaries: AvailableSkuSummary[];
  availableBatchSummaries: AvailableBatchSummary[];
  selectedSkuCode: string;
  selectedBatchNo: string;
  onSkuSelect: (skuCode: string) => void;
  onBatchSelect: (batchNo: string) => void;
  formatLocationLabel?: (locationCode: string) => string;
  children?: ReactNode;
}) {
  const {
    title,
    purposeLabel,
    skus,
    availableSkuSummaries,
    availableBatchSummaries,
    selectedSkuCode,
    selectedBatchNo,
    onSkuSelect,
    onBatchSelect,
    formatLocationLabel,
    children,
  } = props;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <SkuBatchSearchPanel
          purposeLabel={purposeLabel}
          skus={skus}
          availableSkuSummaries={availableSkuSummaries}
          availableBatchSummaries={availableBatchSummaries}
          selectedSkuCode={selectedSkuCode}
          selectedBatchNo={selectedBatchNo}
          onSkuSelect={onSkuSelect}
          onBatchSelect={onBatchSelect}
          formatLocationLabel={formatLocationLabel}
        />
        {children}
      </CardContent>
    </Card>
  );
}
