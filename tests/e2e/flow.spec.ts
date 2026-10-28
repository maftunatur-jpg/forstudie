import { expect, test } from "@playwright/test";
import path from "node:path";

test("nytt projekt → besök → foto → rapport", async ({ page }) => {
  page.on("dialog", (d) => d.accept());

  await page.goto("/");
  await expect(page.getByTestId("sync-badge")).toHaveText("Lokalt läge");

  // Nytt projekt
  await page.getByRole("link", { name: "+ Nytt projekt" }).click();
  await page.getByLabel("Projektnamn *").fill("E2E-fastigheten 1:1");
  await page.getByLabel("Fastighetsbeteckning").fill("E2E-fastigheten 1:1");
  await page.getByLabel("Nivå 1 – namn *").fill("Lamell");
  await page.getByLabel("Nivå 1 – värden *").fill("A-C");
  await page.getByRole("button", { name: "Skapa projekt" }).click();
  await expect(page.getByRole("heading", { name: "E2E-fastigheten 1:1" })).toBeVisible();
  await expect(page.getByText("Inga lägenheter ännu")).toBeVisible();

  // Nytt besök
  await page.getByRole("button", { name: "+ Ny lägenhet" }).click();
  await page.getByRole("button", { name: "B", exact: true }).click();
  await page.getByTestId("object-number").fill("1101");
  // Badrum är första sektionen och redan öppen.
  await page.getByRole("button", { name: "Klinker", exact: true }).click();
  await expect(page.locator("summary", { hasText: "Badrum" })).toContainText("1/");

  // Foto (kamera-inputen tar emot en fil)
  await page.getByTestId("camera-input").first().setInputFiles(path.join(__dirname, "../../public/icons/icon-512.png"));
  await expect(page.getByAltText("Foto").first()).toBeVisible();

  // Samlad bedömning
  await page.getByRole("button", { name: "Brister" }).last().click();
  await expect(page.getByTestId("save-status")).toHaveText("Sparat");

  // Tillbaka till projektet: besöket syns i översikten
  await page.getByRole("link", { name: "Tillbaka" }).click();
  await expect(page.getByText("1101")).toBeVisible();
  await expect(page.getByRole("link", { name: /Lgh 1101.*1 foton.*Brister/ })).toBeVisible();

  // Rapport
  await page.getByRole("link", { name: "Rapport", exact: true }).click();
  await page.getByTestId("summary").fill("Sammanfattning från e2e-testet.");
  await page.getByTestId("summary").blur();

  const [pdf] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-pdf").click()]);
  expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  expect((await import("node:fs")).statSync((await pdf.path())!).size).toBeGreaterThan(2000);

  const [docx] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-docx").click()]);
  expect(docx.suggestedFilename()).toMatch(/\.docx$/);
});
