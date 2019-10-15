const { readFileSync } = require("fs");
const { join } = require("path");

const readFile = x => readFileSync(join(__dirname, x), "utf8");

function PaulsReactor(...scripts)
{
	return eval(scripts.join(";\n"));
}

PaulsReactor(
	readFile("../Truth/build/truth.js"),
	readFile("../Backer/Encoder/build/encoder.js"),
	readFile("./build/encoder.js"),
	"Encoder.run();"
);