import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";

test.use({
  ignoreHTTPSErrors: true,
  video: "on",
  launchOptions: { slowMo: 350 },
});

const baseURL = process.env.DEMO_BASE_URL ?? "https://localhost";
const adminEmail = process.env.DEMO_ADMIN_EMAIL ?? "admin@gouv.bf";
const adminPassword = process.env.DEMO_ADMIN_PASSWORD ?? "AdminDemo2026!#";

type DemoAgent = {
  id: string;
  nom: string;
  email: string;
  statut: string;
};

function currentTotp(): string {
  const python = process.env.PYTHON ?? "python";
  const generator = fileURLToPath(new URL("./generate_totp.py", import.meta.url));
  return execFileSync(python, [generator], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

test("demo jury: login, encrypted group, and revocation", async ({ page, request }) => {
  test.setTimeout(180_000);
  await page.goto(`${baseURL}/connexion`);
  await expect(page.getByRole("heading", { name: /connexion/i })).toBeVisible();

  await page.getByLabel(/adresse e-mail professionnelle/i).fill(adminEmail);
  await page.getByLabel("Mot de passe").fill(adminPassword);
  // Generate the code immediately before submitting so the 30 second step does not expire.
  await page.getByLabel(/code d'authentification/i).fill(currentTotp());

  const loginResponsePromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /se connecter/i }).click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status()).toBe(200);
  const login = await loginResponse.json();
  const accessToken = login.access_token as string;
  expect(accessToken).toBeTruthy();

  // Admin sessions currently land on P13; continue to the requested P04 inbox.
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: /messagerie e2ee/i }).click();
  await expect(page).toHaveURL(`${baseURL}/`);
  await expect(page.getByRole("heading", { name: /mes conversations/i })).toBeVisible();

  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const agentsResponse = await request.get(`${baseURL}/api/admin/agents`, { headers: authHeaders });
  expect(agentsResponse.status()).toBe(200);
  const agents = (await agentsResponse.json()) as DemoAgent[];
  const findAgent = (label: string) => {
    const agent = agents.find((candidate) => candidate.nom.toLowerCase().includes(label.toLowerCase()));
    expect(agent, `missing active ${label} demo agent`).toBeTruthy();
    expect(agent!.statut).toBe("actif");
    return agent!;
  };
  const agentA = findAgent("Agent A");
  const agentB = findAgent("Agent B");
  const agentC = findAgent("Agent C");

  const roomName = `Demo cell ${new Date().toISOString().slice(11, 19)}`;
  const groupResponse = await request.post(`${baseURL}/api/admin/groupes`, {
    headers: authHeaders,
    data: {
      nom: roomName,
      membres_emails: [agentA.email, agentB.email, agentC.email],
    },
  });
  expect(groupResponse.status()).toBe(201);
  const group = await groupResponse.json();
  expect(group.chiffrement_actif).toBe(true);
  expect(group.membres_invites).toHaveLength(3);
  expect(group.membres_refus).toHaveLength(0);

  await page.goto(`${baseURL}/salon/${encodeURIComponent(group.room_id)}`);
  const message = "Situation under control. The demo group is encrypted.";
  const messageInput = page.locator('input[placeholder*="message"]');
  await expect(messageInput).toBeVisible({ timeout: 60_000 });
  await messageInput.fill(message);
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(page.getByText(message)).toBeVisible({ timeout: 30_000 });

  await page.goto(`${baseURL}/admin`);
  await expect(page.getByRole("heading", { name: /tableau de bord/i })).toBeVisible();
  await page.getByRole("link", { name: "Agents", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/agents$/);

  const agentRow = page.locator("tr").filter({ hasText: agentB.nom });
  await expect(agentRow).toBeVisible();
  await agentRow.getByRole("link", { name: "Consulter" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/agents/${agentB.id}$`));
  await page.locator("button").filter({ hasText: /l'accès de/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: /^Confirmer la/ }).click();
  await expect(page).toHaveURL(/\/admin\/agents$/);

  const revokedAgentsResponse = await request.get(`${baseURL}/api/admin/agents`, { headers: authHeaders });
  expect(revokedAgentsResponse.status()).toBe(200);
  const revokedAgents = (await revokedAgentsResponse.json()) as DemoAgent[];
  expect(revokedAgents.find((agent) => agent.id === agentB.id)?.statut).toBe("revoque");

  // Revoked status is checked before password/TOTP, so no Agent B credential is embedded here.
  await page.goto(`${baseURL}/connexion`);
  await page.getByLabel(/adresse e-mail professionnelle/i).fill(agentB.email);
  await page.getByLabel("Mot de passe").fill("invalidated-after-revocation");
  await page.getByLabel(/code d'authentification/i).fill("000000");
  const revokedLoginPromise = page.waitForResponse(
    (response) => response.url().endsWith("/api/auth/login") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: /se connecter/i }).click();
  const revokedLogin = await revokedLoginPromise;
  expect(revokedLogin.status()).toBe(401);
  await expect(page.getByTestId("login-error-message")).toBeVisible();
});
