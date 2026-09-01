# Third-party notices

VerifyFirst's original source code is licensed under the repository's MIT
License. The following files and build inputs retain their upstream licenses.
The Apache License 2.0 text is included at
[`LICENSES/Apache-2.0.txt`](LICENSES/Apache-2.0.txt).

## GLEIF-IT/vlei-verifier

- Upstream: <https://github.com/GLEIF-IT/vlei-verifier>
- License: Apache License 2.0
- Pinned commit: `5850051b52dce24ed59eae486af76e7c73f6012c`
- Pinned source archive SHA-256:
  `40bc4b8586d5ecd409937837d43de27aaf0940d49c24ba40d17c28d753bc385f`
- The pinned upstream tree contains an Apache-2.0 `LICENSE` and no upstream
  `NOTICE` file.

Redistributed test material:

- `public/update-trust/credential.cesr`
- Upstream path: `tests/data/credential/credential.cesr`
- Upstream URL:
  <https://raw.githubusercontent.com/GLEIF-IT/vlei-verifier/5850051b52dce24ed59eae486af76e7c73f6012c/tests/data/credential/credential.cesr>
- File SHA-256:
  `daa4bf2dae79a8ae6d9548f2c158144af648fecd7aea49ca46a203c906cca643`
- Modification status: copied without modification as a regression fixture.
  It uses test key state and is not a credential issued to a real organization.

Container build and local modification:

- `services/vlei-verifier/Dockerfile.vercel` downloads and packages the pinned
  upstream source archive for a public, non-durable, test-mode live demo.
- `services/vlei-verifier/patches/0001-parse-http-port-as-integer.patch`
  modifies upstream
  `src/verifier/app/cli/commands/server/start.py` by making the `--http` option
  parse as an integer. This modification is maintained by VerifyFirst and is not
  represented as an upstream GLEIF-IT change.
- The demo container is not a production verifier distribution. Its base image
  and Python packages have their own licenses; operators rebuilding or
  redistributing the image should retain those licenses and generate an SBOM.

## GLEIF-IT/vLEI-schema

- Upstream: <https://github.com/GLEIF-IT/vLEI-schema>
- License: Apache License 2.0
- Pinned commit: `97850396f504bf8c4e19a42af3290e4b2618f50e`

VerifyFirst records the following upstream schema filenames and self-addressing
identifiers (SAIDs) in `public/update-trust/said.js`; the demo verifier loads the
same six schemas from commit-pinned URLs:

| Upstream file | Schema SAID |
|---|---|
| `qualified-vLEI-issuer-vLEI-credential.json` | `EBfdlu8R27Fbx-ehrqwImnK-8Cm79sqbAQ4MmvEAYqao` |
| `legal-entity-vLEI-credential.json` | `ENPXp1vQzRF6JwIuS-mp2U8Uf1MoADoP_GqQ62VsDZWY` |
| `oor-authorization-vlei-credential.json` | `EKA57bKBKxr_kN7iN5i7lMUxpMG-s19dRcmov1iDxz-E` |
| `legal-entity-official-organizational-role-vLEI-credential.json` | `EBNaNu-M9P5cgrnfl2Fvymy4E_jvxxyjb70PRtiANlJy` |
| `ecr-authorization-vlei-credential.json` | `EH6ekLjSr8V32WyFbGe1zXjTzFs9PkTYmupJ9H65O14g` |
| `legal-entity-engagement-context-role-vLEI-credential.json` | `EEy9PkikFcANV1l7EHukCeXqrzT1hNZjGlUk7wuMO5jw` |

VerifyFirst does not modify or republish the full schema JSON files in the web
application. The filename, source revision, and SAID metadata are preserved so
an operator can reproduce the allow-list. The vLEI Ecosystem Governance
Framework version shown in the UI is governance-document provenance and is not
the version identifier of this schema repository snapshot.

## WebOfTrust/vLEI and WebOfTrust/keripy

- Upstream samples/specifications: <https://github.com/WebOfTrust/vLEI>
- Upstream KERI implementation: <https://github.com/WebOfTrust/keripy>
- License: Apache License 2.0

The legacy Trust Pathways page retrieves its WebOfTrust/vLEI community sample
from pinned commit `743622abc9a3b3684552e439efc5c8b6fda2f645`; it does not track a
moving branch. Live x402 checks use VerifyFirst's same-origin adapter and the
lockfile-pinned IFF package instead of executing an SDK from a public CDN.

`public/trust-pathways/index.html` links to and, when requested by the user,
loads community sample material from WebOfTrust/vLEI. Its bundled fallback is
demo material only. `weboftrust/keri:1.2.0-rc4` is the base of the live demo
container. Neither source is represented as a VerifyFirst production service.

## GLEIF-IT/vlei-trainings

- Upstream: <https://github.com/GLEIF-IT/vlei-trainings>
- License: Apache License 2.0
- Pinned commit: `4af87dc13b3f145c4d078448b1d6ec5a1f4bef25`

VerifyFirst links to the commit-pinned training material for reproducibility; it
does not copy the training repository into this project.

## Names and marks

GLEIF, vLEI, QVI, WebOfTrust, KERI, and related project names are used only to
identify upstream specifications, software, and provenance. Their use does not
imply affiliation, qualification, certification, or endorsement of VerifyFirst.

## Direct JavaScript dependencies

The reviewed `package-lock.json` records exact resolved versions and integrity
digests. Each installed package retains the license distributed in its npm
package; VerifyFirst does not relicense third-party code.

| Package | Locked direct version | License |
|---|---:|---|
| `react`, `react-dom` | 19.2.0 | MIT |
| `lucide-react` | 0.555.0 | ISC |
| `@google/genai` | 1.30.0 | Apache-2.0 |
| `@ifandonlyif/x402-preflight` | 0.1.0 | MIT |
| `@vercel/analytics` | 1.6.1 | MPL-2.0 |
| `tesseract.js` | 7.0.0 | Apache-2.0 |
| `tailwindcss` | 3.4.17 | MIT |
| `postcss` | 8.5.26 | MIT |
| `autoprefixer` | 10.4.21 | MIT |

The IFF package wraps the public IFF service; its inclusion does not imply that
IFF endorses VerifyFirst. Vercel Analytics is compiled into the project only as
an optional component and remains disabled unless an operator explicitly sets
the public build flag documented in `.env.example`.
