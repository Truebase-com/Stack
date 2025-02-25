
namespace make
{
	/**
	 * Copies the source file or folder to the destination file or folder.
	 * To differentiate between a file and a folder, be sure to suffix
	 * paths with a "/" character to indicate a folder.
	 */
	export function copy(src: string, dst: string, filterFn?: (filePath: string) => boolean)
	{
		const srcStat = Fs.lstatSync(src);
		const dstExists = Fs.existsSync(dst);
		const dstStat = dstExists ? Fs.lstatSync(dst) : null;
		const srcIsDir = srcStat.isDirectory();
		const dstIsDir = dstStat ? dstStat.isDirectory() : false;
		
		if (srcIsDir)
		{
			if (dstIsDir || !dstExists)
			{
				// Copy all the files from one directory to another
				FsExtra.copySync(src, dst, {
					recursive: true,
					overwrite: true
				});
			}
			else
			{
				throw new Error("Cannot copy a directory to a file.");
			}
		}
		else if (dstIsDir)
		{
			const parsed = Path.parse(src);
			const dstPath = Path.join(dst, parsed.base);
			FsExtra.removeSync(dstPath);
			FsExtra.copyFileSync(src, dstPath);
		}
		else
		{
			if (FsExtra.existsSync(dst))
				FsExtra.removeSync(dst);
			
			FsExtra.copyFileSync(src, dst);
		}
	}
	
	/**
	 * Creates a file at the specified location, with the specified contents.
	 */
	export function file(path: string, contents: string = "")
	{
		Fs.writeFileSync(path, contents);
	}
	
	/**
	 * Creates the directory structure at the specified location, if it doesn't exist
	 * already. If the path is omitted, a temporary directory is created in the 
	 * working directory.
	 * 
	 * @returns The absolute path of the created directory.
	 */
	export function directory(path?: string)
	{
		const pathValue = path || "./temp-" + Math.random().toString().slice(-10);
		make.shellSync("mkdir -p " + pathValue);
		return Path.resolve(pathValue);
	}
	
	/**
	 * Deletes the specified file from the file system.
	 */
	const makeAny: any = make;
	makeAny.delete = function(src: string)
	{
		if (Fs.existsSync(src))
			Fs.unlinkSync(src);
	};
}

/* eslint-disable */
declare class make
{
	/**
	 * Deletes the specified file from the file system.
	 */
	static delete(src: string): void;
}
