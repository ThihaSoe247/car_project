const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Dynamic folder per car
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // Default folder
    let folder = "car-showroom";

    if (req.params.id) {
      folder = `car-showroom/${req.params.id}`;
    }

    return {
      folder,
      allowed_formats: ["jpg", "png", "jpeg"],
      transformation: [{ width: 800, height: 600, crop: "limit" }],
    };
  },
});

module.exports = { cloudinary, storage };
