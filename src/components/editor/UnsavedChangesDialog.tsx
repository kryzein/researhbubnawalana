import { Save, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UnsavedChangesDialogProps {
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesDialog({ onSave, onDiscard, onCancel, isSaving }: UnsavedChangesDialogProps) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-2xl px-5 py-4 flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">You have unsaved changes</span>
          <span className="text-xs text-muted-foreground">Would you like to save before leaving?</span>
        </div>
        <div className="flex items-center gap-2 ml-2">
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving}
            className="gap-1.5 h-8"
          >
            <Save className="h-3.5 w-3.5" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="gap-1.5 h-8 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Don't Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="gap-1.5 h-8"
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
