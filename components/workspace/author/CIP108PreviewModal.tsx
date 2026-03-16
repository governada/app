'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import type { Cip108Document } from '@/lib/workspace/types';

interface CIP108PreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: { document: Cip108Document; contentHash: string } | null;
}

export function CIP108PreviewModal({ open, onOpenChange, data }: CIP108PreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!data) return null;

  const jsonString = JSON.stringify(data.document, null, 2);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>CIP-108 Preview</span>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            <span className="font-medium">Blake2b-256 Hash:</span>{' '}
            <code className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs">
              {data.contentHash}
            </code>
          </div>

          <pre className="bg-muted rounded-lg p-4 overflow-auto text-sm font-mono max-h-[50vh] whitespace-pre-wrap break-words">
            {jsonString}
          </pre>
        </div>
      </DialogContent>
    </Dialog>
  );
}
