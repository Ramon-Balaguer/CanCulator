# Mobile test checklist

Run it on Android with Chrome and on an iPhone with Safari. Tick each box on both.
If the camera or offline mode fails on the iPhone, report it before starting the next phase.

Public URL: https://ramon-balaguer.github.io/canculator/

UI labels are quoted as they appear in the Spanish interface.

## End of phase 1: base

- [ ] The public URL opens and shows «CanCulator» and, at the bottom, «Versión» with 7 characters (not «desarrollo»).
- [ ] Android: Chrome menu → «Instalar aplicación» or «Añadir a pantalla de inicio». The icon is a can on a green background.
- [ ] iPhone: in Safari, Share → «Añadir a pantalla de inicio». When opened from the icon, Safari's bar is not visible.
- [ ] Open the installed app, close it completely, turn on airplane mode and reopen it: it loads and says «Sin conexión».
- [ ] Turn airplane mode off: it says «En línea» again.

## End of phase 2: local app

- [ ] Add a lot with a photo taken with the camera: the photo shows on the product sheet.
- [ ] Read a real barcode (a can from home) with the camera: the number is correct.
- [ ] Consume 1 unit from Caducidad (expiry): the stock goes down and the lot that expires first is the one proposed.
- [ ] In airplane mode, add one lot and consume another; close the app completely and reopen it: the changes are still there.
- [ ] The next day, open the app: the data is still there (especially on iPhone).
- [ ] From Ajustes (settings), add a new category and location, then remove them: they are kept after closing and reopening the app.
- [ ] Print: the button opens the print dialog and the list prints without the screen tab bar (on iPhone, Share → Print, or «Guardar en Archivos» for PDF).
- [ ] Export JSON: the file downloads (on iPhone it appears in Files). Importing it again does not duplicate anything.
- [ ] A reponer (restock): a product whose minimum is higher than its stock appears, and «Comprado» (bought) opens the add form with the product already filled in.
- [ ] With a saved lot photo, close the app completely and reopen it: the thumbnail is still there (iOS).

## End of phase 3: Open Food Facts

- [ ] Scan the barcode of a known product (for example a can or a supermarket package with a barcode): the name fills in by itself, with the notice «Open Food Facts: …».
- [ ] Scan a barcode that is not in the database: «No está en Open Food Facts» appears and you can type the name; the lot is saved.
- [ ] With airplane mode on, scan a new barcode: «Sin conexión» appears and manual entry still works.
- [ ] Scan the same barcode twice, without saving: the second time is instant (it comes from the cache).
- [ ] After loading the app, the query does not repeat in a loop: it only runs when scanning.
- [ ] After scanning a known product, «Ver todos los datos de Open Food Facts» shows photos, ingredients, nutrients and the field list; offline, the same product is still visible from «Datos de Open Food Facts» in Stock.

## End of phase 4: sync between phones

- [ ] In Ajustes on the main phone: «Guardar y crear sala» (save and create room). On the other phone, scan the QR of the main phone and enter the same password: «Conectado» (connected) appears.
- [ ] Add a lot on one phone: it appears on the other one without doing anything else.
- [ ] Both phones in airplane mode each consume 1 unit of the same lot; turn airplane mode off and let them reconnect: the lot has gone down by 2.
- [ ] The photo of a new lot reaches the other phone.
- [ ] One week later, on the iPhone: the data and the pending queue are still there.
