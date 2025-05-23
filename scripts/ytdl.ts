const ytdl = require("ytdl-core");
ytdl
	.getInfo("https://www.youtube.com/watch?v=AknbizcLq4w")
	.then((info) => console.log("Success:", info.videoDetails.title))
	.catch((err) => console.error("Error:", err));
