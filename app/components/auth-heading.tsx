/*
  Kept apart from auth-shell.tsx so the (client) auth pages import only this
  small block, never the shell's product panel.
*/

/** Title block used at the top of each auth form. */
export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl">{title}</h1>
      {description && <p className="mt-2 text-sm text-ink-muted">{description}</p>}
    </div>
  );
}
