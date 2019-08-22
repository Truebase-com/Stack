
make.on(async () =>
{
	make.typescript("./tsconfig.json", true);
	
	make.typescript("./tsconfig.json", {
		compilerOptions: {
			outFile: "./build/e-work.js"
		}
	}, true);
	
	make.delete("./build/e.js");
	make.copy("./wedge.js", "./build");
	
	make.merge(
		"./build/wedge.js",
		"./build/a.js",
		"./build/b.js",
		"./build/c.js",
		"./build/d.js",
		"./build/e.js"
	);
});

make.on("exit", () => 
{
	console.log("exit");
	make.delete("./s");
});

make.on("start", async () => 
{
	console.log("start");
	await new Promise(r => setTimeout(r, 5));
});

make.on("init", async () => 
{
	console.log("init");
	await new Promise(r => setTimeout(r, 5));
});
