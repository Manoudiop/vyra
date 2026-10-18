import { LoginForm } from './login-form';

export const metadata = { title: 'Connexion · VYRA Admin' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  const { expired } = await searchParams;
  return (
    <main className="narrow">
      <p className="overline">VYRA</p>
      <h1>Administration</h1>
      <p className="muted">Outil interne. Accès réservé aux comptes administrateurs.</p>
      {expired && <p className="notice">Ta session a expiré, reconnecte-toi.</p>}
      <LoginForm />
    </main>
  );
}
