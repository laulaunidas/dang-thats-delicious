const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
const slug = require("slugs");

const storeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: "Please enter a store name"
    },
    slug: String,
    description: {
      type: String,
      trim: true
    },
    tags: [String],
    created: {
      type: Date,
      default: Date.now
    },
    location: {
      type: {
        type: String,
        default: "Point"
      },
      coordinates: [
        {
          type: Number,
          required: "You must supply coordinates"
        }
      ],
      address: {
        type: String,
        required: "You must supply an address"
      }
    },
    photo: String,
    author: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: "You must supply an author"
    }
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

//define our index
storeSchema.index({
  name: "text",
  description: "text"
});

storeSchema.index({ location: "2dsphere" });

storeSchema.pre("save", async function(next) {
  if (!this.isModified("name")) {
    next(); //skip it
    return; // stop this function from running
  }
  this.slug = slug(this.name);
  //find other stores with the same name to have name-1, <name-2></name-2>
  const slugRegex = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, "i");
  const storesWithSlug = await this.constructor.find({ slug: slugRegex });

  if (storesWithSlug.length) {
    this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
  }
  next();
});

//find reviews where the stores _id property === review store property, like join wthis sql
storeSchema.virtual("reviews", {
  ref: "Review", // what mode to link
  localField: "_id", // Which field on the store
  foreignField: "store" // which field onthe review
});

function autopopulate(next) {
  this.populate("reviews");
  next();
}

storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);

storeSchema.statics.getTopStores = function() {
  return this.aggregate([
    // Lookup stores and populates their reviews
    {
      $lookup: {
        from: "reviews",
        localField: "_id",
        foreignField: "store",
        as: "reviews"
      }
    },
    // Filter for only items that have 2 or more reviews
    { $match: { "reviews.1": { $exists: true } } },
    //Add the average reviews field
    {
      $addFields: { averageRating: { $avg: "$reviews.rating" } }
    },
    // sort it by our new field, highets reviews first
    { $sort: { averageRating: -1 } },
    //limit to at most 10
    { $limit: 10 }
  ]);
};

storeSchema.statics.getTagsList = function() {
  return this.aggregate([
    { $unwind: "$tags" },
    { $group: { _id: "$tags", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
};
module.exports = mongoose.model("Store", storeSchema);
