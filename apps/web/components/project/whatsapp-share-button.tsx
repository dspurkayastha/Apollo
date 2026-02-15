"use client";

import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface WhatsAppShareButtonProps {
  shareUrl: string;
  projectTitle: string;
}

export function WhatsAppShareButton({
  shareUrl,
  projectTitle,
}: WhatsAppShareButtonProps) {
  const message = encodeURIComponent(
    `Please review my thesis "${projectTitle}" on Apollo:\n${shareUrl}`
  );
  const waUrl = `https://wa.me/?text=${message}`;

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => window.open(waUrl, "_blank")}
      className="gap-1.5"
    >
      <MessageCircle className="h-4 w-4" />
      WhatsApp
    </Button>
  );
}
