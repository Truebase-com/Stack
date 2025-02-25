
namespace Truth
{
	/**
	 * @internal
	 */
	export class Script
	{
		/**
		 * 
		 */
		static async import(uri: KnownUri)
		{
			const uriText = uri.toString();
			const env = Misc.guessEnvironment();
			const glob = Misc.global;
			const hasDeclare = "declare" in glob;
			let storedDeclare = hasDeclare ? glob.declare : undefined;
			
			if (env === ScriptEnvironment.node)
			{
				if (uri.protocol !== UriProtocol.file)
					throw Exception.noRemoteScripts();
				
				glob.declare = Truth.declare;
				require(uriText);
				
				if (hasDeclare)
					glob.declare = storedDeclare;
				else
					delete glob.declare;
				
				return extractSourceObjects("");
			}
			else if (env === ScriptEnvironment.browser)
			{
				const scriptUrl = getCurrentScript();
				
				Object.defineProperty(glob, "declare", {
					configurable: true,
					enumerable: false,
					writable: false,
					get: () =>
					{
						return declaredSourceObjects.has(scriptUrl) ?
							Truth.declare :
							storedDeclare;
					}
				});
				
				const error = await new Promise(done =>
				{
					const scriptTag = document.createElement("script");
					scriptTag.type = "text/javascript";
					scriptTag.src = uriText;
					
					scriptTag.onload = () =>
					{
						done();
						console.log();
					};
					
					scriptTag.onerror = () =>
					{
						done(Exception.scriptLoadError(uriText, ""));
					};
					
					document.head.appendChild(scriptTag);
				});
				
				delete glob.declare;
				
				if (error instanceof Error)
					return error;
				
				return extractSourceObjects(scriptUrl);
			}
			
			return Exception.unsupportedPlatform();
		}
	}
	
	/** */
	function extractSourceObjects(key: string): SourceObject
	{
		const result = declaredSourceObjects.get(key);
		if (result === undefined)
			return {};
		
		declaredSourceObjects.delete(key);
		if (result.length === 0)
			return {};
		
		if (result.length === 1)
			return result[0];
		
		return Object.assign({}, ...result);
	}
	
	/**
	 * Returns the URL of the script being executed, in the case when
	 * the script being executed was loaded via a <script> tag. In other 
	 * cases, for example if hosting environment is Node.js, the returned
	 * value is an empty string.
	 */
	function getCurrentScript()
	{
		const script = document.currentScript;
		return script instanceof HTMLScriptElement ?
			script.src :
			"";
	}
	
	const declaredSourceObjects = new MultiMap<string, SourceObject>();
		
	/**
	 * 
	 */
	export function declare(sourceObject: SourceObject): void;
	/**
	 * 
	 */
	export function declare(declaration: string, ...annotations: Annotation[]): void;
	/** */
	export function declare(...args: (Annotation | SourceObject)[])
	{
		if (args.length === 0)
			throw Exception.invalidArgument();
		
		const a0 = args[0];
		let sourceObject: SourceObject;
		
		if (typeof a0 === "string")
		{
			sourceObject = {
				[a0]: args.slice(1).filter(v => typeof v !== "object" && v !== null)
			};
		}
		else if (args.length === 1)
		{
			const a0 = args[0] as SourceObject;
			
			if (!a0 || typeof a0 !== "object")
				throw Exception.invalidArgument();
			
			sourceObject = a0;
		}
		else throw Exception.invalidArgument();
		
		const env = Misc.guessEnvironment();
		if (env === ScriptEnvironment.node)
		{
			declaredSourceObjects.add("", sourceObject);
		}
		else if (env === ScriptEnvironment.browser)
		{
			const url = getCurrentScript();
			if (url)
				declaredSourceObjects.add(url, sourceObject);
		}
	}
	
	/**
	 * A special key used to specified an anonymous type in a block of Jsonized truth.
	 */
	export const anonymous = "__ANONYMOUS__";
	
	/**
	 * A type that represents a basic right-side value in a scripted Truth structure.
	 */
	export type Annotation = string | number;
	
	/**
	 * A type that describes Truth information organized into a
	 * (potentially recursive) JSON structure.
	 */
	export type SourceObject = 
	{
		[declaration: string]: 
			Annotation | SourceObject | SourceObjectMethods |
			(Annotation | SourceObject | SourceObjectMethods)[];
	}
	
	/**
	 * An object type that specifies the methods that may be defined
	 * on a source object defined within a script.
	 */
	export type SourceObjectMethods  =
	{
		/**
		 * A callback function that is invoked when a call to Document.fold or
		 * Program.fold is made.
		 * 
		 * Folding a Truth document works like a recursive reduce. Each type may
		 * provide a folding function, which takes the results of the fold functions
		 * the correspond to each of it's inner types. It then returns a value which
		 * is sent upward to the fold function of the outer type. For types that
		 * define no fold function, the data is passed through them verbatim.
		 * 
		 * NOTE: Do we need a fold message here so that the same avatar can
		 * respond to multiple kinds of folds?
		 */
		fold?(this: Type, target: Type, into: () => unknown): any;
		
		/**
		 * A callback function that is invoked when the type is to be introspected.
		 * Provides a means to "delegate" the type, meaning that the types that
		 * are returned are assumed to take the place of the type being introspected.
		 * This method should be implemented by avatars that wish to provide
		 * a querying mechanism into Truth, in order to create the effect of
		 * replacing a type with another set of types found elsewhere in the program.
		 */
		delegate?(this: Type, physicalType: Type): Type[];
	}
}
