# Solution — Dataverse-side artifacts

This folder holds the **unpacked** Power Platform solution that wraps the React Code App. It contains:

| Component | Purpose |
|---|---|
| **Workflows/Get-Agents-*.json** | Power Automate cloud flow — wraps Dataverse "List rows in environment" with FetchXML, returns agent list |
| **Workflows/Get-Transcripts-*.json** | Same pattern for conversation transcripts |
| **Other/Customizations.xml** | Connection reference (`msftcsa_MCSConvoViewerDataverse`) — Dataverse connector |
| **Other/Solution.xml** | Solution manifest |
| **CanvasApps/*.meta.xml** | Code App metadata stub (the actual bundle lives in `my-app/dist/`, deployed via `power-apps push`) |

The solution name (in maker) is **`ConvTranscriptViewerCodeApps`** (logical: `convtranscriptviewercodeapps`).

> **Note:** The compiled Code App bundle (`CanvasApps/*_CodeAppPackages/`) is gitignored — it's regenerated on every `npx power-apps push`. Only the `.meta.xml` stub is tracked so the solution still references the Code App component.

---

## 🔄 Pack ↔ Unpack workflow

### Pack (commit local changes → import zip)

```powershell
cd my-app
pac solution pack `
  --folder solution\src `
  --zipFile solution\out\ConvTranscriptViewerCodeApps.zip `
  --packageType Unmanaged
```

Then import the resulting zip via maker portal *or*:

```powershell
pac solution import --path solution\out\ConvTranscriptViewerCodeApps.zip
```

### Unpack (after re-exporting from maker → refresh local source)

```powershell
cd my-app
pac solution unpack `
  --zipFile <path-to-downloaded-export>.zip `
  --folder solution\src `
  --packageType Unmanaged
```

> ⚠️ Unpack overwrites files in-place. Commit local changes first.

---

## 🔌 Flow input legend (verified against trigger schema)

Both flows use the same shape — Logic Apps trigger field IDs `text` / `text_6` map to the human-readable titles set in the Power Automate UI:

| Field key | UI title | Meaning |
|---|---|---|
| `text` | `envUrl` | Dataverse environment URL (e.g. `https://orgname.crm.dynamics.com`) |
| `text_6` | `fetchXml` | FetchXML query string |

The codegen for `src/generated/services/Get_AgentsService.ts` and `Get_TranscriptsService.ts` uses the *keys* (`text` / `text_6`), not the titles — that's a Power Apps quirk. The full legend lives in `src/components/BrowseFlows/flowDataSource.ts` for any code-side consumers.

---

## 🆕 First-time env setup (new contributor)

1. Pack and import the solution (commands above)
2. In maker → **Connection References**, set `msftcsa_MCSConvoViewerDataverse` to your Dataverse connection
3. In maker → **Cloud flows**, **turn on** both `Get-Agents` and `Get-Transcripts`
4. Switch to `my-app/` and run:
   ```powershell
   npm install
   npx power-apps refresh-data-source   # regenerates src/generated/ against your env
   npx power-apps push                  # publishes the Code App bundle into the imported solution
   ```

See the root [`README.md`](../README.md) for ongoing dev workflow.
