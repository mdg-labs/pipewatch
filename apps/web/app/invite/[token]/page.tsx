import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { InviteAcceptCard } from "@/components/invites/InviteAcceptCard";
import { ApiAuthProvider } from "@/hooks/use-api";
import { ACCESS_COOKIE_NAME, hasAuthSession } from "@/lib/auth-cookies";

import "@/components/invites/invite-accept.css";

type InviteAcceptPageProps = {
  params: Promise<{ token: string }>;
};

/** Public invite landing — sign-in gate then accept flow (pages B18). */
export default async function InviteAcceptPage({ params }: InviteAcceptPageProps) {
  const { token } = await params;
  const cookieStore = await cookies();

  if (!hasAuthSession(cookieStore)) {
    redirect(`/sign-in?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const initialAccessToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? null;

  return (
    <main className="pw-invite-accept-page">
      <ApiAuthProvider initialAccessToken={initialAccessToken}>
        <InviteAcceptCard token={token} />
      </ApiAuthProvider>
    </main>
  );
}
