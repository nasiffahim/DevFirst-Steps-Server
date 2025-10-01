import { ObjectId } from "mongodb";

// add user post
export const allPost =  async (req, res, discussion) => {
  try {
const email = req.query.email; // get email from query string


  if (!email) return res.status(400).json({ error: "Email is required" });


    const posts = await discussion.find({ "email": email })
      .sort({ timestamp: -1 })
      .toArray();

    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
//  remove post  one

export const removePost = async (req, res, discussion) => {
  const { id } = req.params; // <-- req must be first

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid post ID" });
  }
  try {
    const result = await discussion.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    res.json({ success: true, message: "Post deleted successfully" });
  } catch (error) {
    console.error("Delete post error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

//  single post show  is  edit page
export const singlePost= async(req, res,discussion)=>{

  const { id } = req.params;
  try {
    const post = await discussion.findOne({ _id: new ObjectId(id) });

    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    res.status(200).json(post);
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
//  edit page  updata
export const updatePost = async (req, res, discussion) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid post ID format" });
    }

    // Using updateOne
    const result = await discussion.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (result.modifiedCount === 0) {
      return res.status(200).json({ message: "No changes made to the post" });
    }

    // Fetch the updated document
    const updatedPost = await discussion.findOne({ _id: new ObjectId(id) });
    
    res.json({ 
      message: "Post updated successfully",
      updatedPost 
    });
  } catch (error) {
    console.error("Failed to update post:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};