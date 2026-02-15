"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Upload,
  Sparkles,
  FileSpreadsheet,
  Trash2,
  Loader2,
} from "lucide-react";
import type { Dataset } from "@/lib/types/database";

interface DatasetUploadProps {
  projectId: string;
  datasets: Dataset[];
}

type Tab = "upload" | "generate";

interface ColumnPreview {
  name: string;
  type: string;
  role?: string;
}

interface DatasetPreview {
  dataset: Dataset;
  headers: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
}

export function DatasetUpload({ projectId, datasets }: DatasetUploadProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("upload");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<DatasetPreview | null>(null);
  const [sampleSize, setSampleSize] = useState("100");
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleFileUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch(`/api/projects/${projectId}/datasets`, {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message ?? "Upload failed");
        }

        const { data } = await res.json();
        setPreview({
          dataset: data,
          headers: data.preview.headers,
          rows: data.preview.rows,
          totalRows: data.preview.totalRows,
        });
        toast.success("Dataset uploaded successfully");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [projectId, router]
  );

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/datasets/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sample_size: parseInt(sampleSize) || 100,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message ?? "Generation failed");
      }

      const { data } = await res.json();
      setPreview({
        dataset: data,
        headers: data.preview.headers,
        rows: data.preview.rows,
        totalRows: data.preview.totalRows,
      });
      toast.success("Dataset generated successfully");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [projectId, sampleSize, router]);

  const handleDelete = useCallback(
    async (datasetId: string) => {
      setDeleting(datasetId);
      try {
        const res = await fetch(
          `/api/projects/${projectId}/datasets/${datasetId}`,
          { method: "DELETE" }
        );
        if (res.ok || res.status === 204) {
          toast.success("Dataset deleted");
          router.refresh();
        }
      } catch {
        toast.error("Failed to delete dataset");
      } finally {
        setDeleting(null);
      }
    },
    [projectId, router]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Datasets</h3>

      {/* Existing datasets */}
      {datasets.length > 0 && (
        <div className="space-y-2">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3">
                <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">
                    {ds.file_url.split("/").pop()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ds.row_count ?? 0} rows &middot;{" "}
                    {(ds.columns_json as Record<string, unknown>[])?.length ?? 0} columns
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(ds.id)}
                disabled={deleting === ds.id}
              >
                {deleting === ds.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-md border p-0.5">
        <Button
          size="sm"
          variant={activeTab === "upload" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("upload")}
          className="h-8 flex-1 gap-1.5 text-xs"
        >
          <Upload className="h-3.5 w-3.5" />
          Upload
        </Button>
        <Button
          size="sm"
          variant={activeTab === "generate" ? "secondary" : "ghost"}
          onClick={() => setActiveTab("generate")}
          className="h-8 flex-1 gap-1.5 text-xs"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Generate
        </Button>
      </div>

      {/* Upload tab */}
      {activeTab === "upload" && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 transition-colors hover:border-muted-foreground/50"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv,.xlsx";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) handleFileUpload(file);
            };
            input.click();
          }}
        >
          {uploading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : (
            <>
              <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Drag &amp; drop CSV or Excel file, or click to browse
              </p>
            </>
          )}
        </div>
      )}

      {/* Generate tab */}
      {activeTab === "generate" && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">
            Generate a dataset from your synopsis metadata and Review of
            Literature findings.
          </p>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Sample size:</label>
            <Input
              type="number"
              value={sampleSize}
              onChange={(e) => setSampleSize(e.target.value)}
              min={10}
              max={1000}
              className="w-24"
            />
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? "Generating..." : "Generate Dataset"}
          </Button>
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div className="space-y-2 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">
              Preview ({preview.totalRows} rows)
            </h4>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setPreview(null)}
            >
              Close
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  {preview.headers.map((h) => (
                    <th
                      key={h}
                      className="px-2 py-1 text-left font-medium text-muted-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-b last:border-0">
                    {preview.headers.map((h) => (
                      <td key={h} className="px-2 py-1">
                        {String(row[h] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
