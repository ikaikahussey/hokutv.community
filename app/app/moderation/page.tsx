import { getModerationQueue } from "./actions";
import { ModerationQueue } from "./queue";

/**
 * Manual ad moderation queue (build-prompt §8). Reserved for the platform_admin
 * role — RLS already scopes campaign reads, and the live queue only returns rows
 * an admin may see. Each item shows automated flags; approve makes it live,
 * reject auto-refunds the unspent budget via Stripe.
 */
export default async function ModerationPage() {
  const queue = await getModerationQueue();

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold text-ink">
          Ad moderation
        </h1>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          platform admin
        </span>
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Review pending campaigns. Rejections refund the unspent budget.
      </p>
      <ModerationQueue initial={queue} />
    </main>
  );
}
