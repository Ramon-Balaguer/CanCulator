# Adding lots and the scanner

The **+** button adds a lot. Type the product name, or scan its barcode with the camera.

- If the barcode is in Open Food Facts, the name, category and nutrition data are filled in automatically.
- GS1 Digital Link QR codes (for example, some supermarket labels) are also read: the GTIN is used as the code, and the expiry date (application identifier 17, or the `?17=` query parameter) fills in the Caducidad (expiry) field.
- From a product's sheet, adding a lot only asks for location, expiry and units, because the product is already known.
- If the product already exists, its name is fixed.
- Each product can have a photo and notes (see [Photos](08-photos.md)).

Without a connection, scanning a new barcode shows that there is no connection, and the lot can be added by hand.

Related: [Open Food Facts](07-open-food-facts.md), [Weight, volume and price](14-weight-volume-and-price.md).
