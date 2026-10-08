import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  domain: string;
  description: string;
  descriptionAfter?: string;
  confirmLabel?: string;
  // Accept async handlers (the revoke flow awaits an API call) as well as sync ones.
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDestructiveDialog({
  open,
  onOpenChange,
  title,
  domain,
  description,
  descriptionAfter,
  confirmLabel = "Confirm",
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description} <span className="font-mono text-foreground">{domain}</span>
            {descriptionAfter ? ` ${descriptionAfter}` : "."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            // onClick expects void; wrap so an async onConfirm rejection is caught/logged rather than
            // becoming an unhandled promise rejection (the revoke handler already toasts on failure).
            onClick={() => { Promise.resolve(onConfirm()).catch((e) => console.error('ConfirmDestructiveDialog onConfirm failed', e)); }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
