---
title: Open API Enforcer Multer
navOrder: single multiple
toc: false
---

This package works along side the [multer](https://www.npmjs.com/package/multer) package and the [openapi-enforcer-middleware](https://www.npmjs.com/package/openapi-enforcer-middleware) package to make file uploads for your API simple.

- Works with Open API version 2.0 and 3.x.x.

- Works with multer storage options:

    - DiskStorage
    - MemoryStorage
    

**You should not use the multer uploads `single`, `array`, `fields` or other functions.** Those functions will automatically be set up for you based on your Open API document's specification.

## Installation

You must install the peer dependency `multer` along side this package.

```bash
npm install openapi-enforcer-multer multer
```

## Usage

For a more thorough example, please see the demo directory included with this package. It provides a simple API for adding people with pictures, getting those people, and downloading the picture in base64 and binary formats.

It is possible to use this middleware with:

1. A [single multer](single.md). This makes sense if all upload will go to the same location and have the same maximum size.

2. [More than on multer](multiple.md). This makes sense if your uploads may be stored in different locations or have different size constraints.
