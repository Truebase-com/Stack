
namespace Truth
{
	/**
	 * This example demonstrates declaration-side chaining
	 * of multiple types, and applying a single annotation to all types.
	 */
	async function coverLanguageChaining()
	{
		const [doc] = await createLanguageCover(`
			type
			a, b, c : type
			
			container
				a
				b
				c
		`);
		
		const [type, a, b, c] = typesOf(doc, 
			"type",
			["container", "a"],
			["container", "b"],
			["container", "c"]);
		
		return [
			() => a.is(type),
			() => b.is(type),
			() => c.is(type)
		];
	}
}
