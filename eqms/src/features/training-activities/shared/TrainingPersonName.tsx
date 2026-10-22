import { Avatar } from "@/components/ui/avatar";

/** The name of a person in a table, with the avatar before it, as in User Management. With `onClick` the name is a link to the record of the row. */
export function TrainingPersonName({ fullName, avatar, onClick }: { fullName: string; avatar?: string | null; onClick?: () => void }) {
  const content = (
    <>
      <Avatar name={fullName || "User"} src={avatar} tone="brand" className="h-8 w-8" />
      <span className={onClick ? "font-medium text-emerald-600 hover:underline" : "font-medium text-slate-900"}>{fullName}</span>
    </>
  );
  return onClick
    ? <button type="button" className="flex items-center gap-2.5 text-left" onClick={onClick}>{content}</button>
    : <div className="flex items-center gap-2.5">{content}</div>;
}
