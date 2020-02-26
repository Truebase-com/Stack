
namespace Truth
{
	/**
	 * @internal
	 * A worker class that handles the construction of networks
	 * of Parallel instances, which are eventually transformed
	 * into type objects.
	 */
	export class ConstructionWorker
	{
		/** */
		constructor(private readonly program: Program)
		{
			this.cruft = new CruftCache(this.program);
		}
		
		/**
		 * Constructs the corresponding Parallel instances for
		 * all explicit types that exist within the provided Document,
		 * or below the provided ExplicitParallel.
		 */
		excavate(from: Document | ExplicitParallel)
		{
			if (this.excavated.has(from))
				return;
			
			this.excavated.add(from);
			const queue: ExplicitParallel[] = [];
			
			if (from instanceof Document)
			{
				for (const phrase of Phrase.rootsOf(from))
				{
					debugger;
					// TODO
					const drilledParallel = this.drillFromNode("phrase.associatedNode" as any);
					if (drilledParallel !== null)
						queue.push(drilledParallel);
				}
			}
			else for (const currentParallel of queue)
			{
				for (const node of currentParallel.node.contents.values())
				{
					const drilledParallel = this.drillFromNode(node);
					if (drilledParallel !== null)
						queue.push(drilledParallel);
				}
			}
		}
		
		/** */
		private readonly excavated = new WeakSet<ExplicitParallel | Document>();
		
		/**
		 * Constructs the fewest possible Parallel instances
		 * to arrive at the type specified by the directive.
		 */
		drill(directive: Phrase)
		{
			const result = this.drillFromPhrase(directive);
			this.drillQueue.length = 0;
			return result;
		}
		
		/** */
		private drillFromPhrase(directive: Phrase)
		{
			if (this.parallels.has(directive))
				return Not.undefined(this.parallels.get(directive));
			
			if (directive.length === 0)
				throw Exception.invalidArgument();
			
			const ancestry = directive.ancestry;
			const surfacePhrase = directive.ancestry[0];
			
			const surfaceNode = directive.containingDocument.phrase
				.peek(surfacePhrase.terminal, surfacePhrase.clarifierKey);
			
			// TODO (below)
			debugger;
			
			if (surfaceNode === null)
				return null;
			
			let typeIdx = 0;
			let lastSeed = 
				this.parallels.get(directive.back()) ||
				this.rake(this.parallels.create(surfaceNode as any, this.cruft));
			
			// This code skips by any Parallel instances that have already
			// been constructed. The real work begins when we get to
			// the first point in the Phrase where there is no constructed
			// Parallel instance.
			for (const phrase of ancestry)
			{
				if (!this.parallels.has(phrase))
					break;
				
				lastSeed = Not.undefined(this.parallels.get(phrase));
				
				if (++typeIdx >= directive.length)
					return lastSeed;
			}
			
			do
			{
				const targetSubject = ancestry[typeIdx].terminal;
				const descended = this.descend(lastSeed, targetSubject);
				if (descended === null)
					return null;
				
				lastSeed = this.rake(descended);
			}
			while (++typeIdx < directive.length);
			
			return lastSeed;
		}
		
		/**
		 * An entrypoint into the drill function that operates
		 * on a Node instead of a Phrase. Essentially, this method
		 * calls "drillFromPhrase()" safely (meaning that it detects
		 * circular invokations, and returns null in these cases).
		 */
		private drillFromNode(node: Node)
		{
			// Circular drilling is only a problem if we're
			// drilling on the same level.
			const dq = this.drillQueue;
			
			if (dq.length === 0)
			{
				dq.push(node);
			}
			else if (dq[0].container === node.container)
			{
				if (dq.includes(node))
					return null;
			}
			else
			{
				dq.length = 0;
				dq.push(node);
			}
			
			const drillResult = this.drillFromPhrase(node.phrase);
			if (drillResult === null)
				throw Exception.unknownState();
			
			if (!(drillResult instanceof ExplicitParallel))
				throw Exception.unknownState();
			
			return drillResult;
		}
		
		/** A call queue used to prevent circular drilling. */
		private readonly drillQueue: Node[] = [];
		
		/**
		 * "Raking" a Parallel is the process of deeply traversing it's
		 * Parallel Graph (depth first), and for each visited Parallel,
		 * deeply traversing it's Base Graph as well (also depth first).
		 * Through this double-traversal process, the Parallel's edges
		 * are constructed into a traversable graph.
		 */
		private rake(seed: Parallel)
		{
			// If the seed's container is null, this means that the seed
			// is root-level, and so it cannot have any Parallel types.
			// It may however have Base types, and these need to be
			// handled.
			if (seed.container === null)
			{
				if (!(seed instanceof ExplicitParallel))
					throw Exception.unknownState();
				
				this.rakeExplicitParallel(seed);
			}
			else this.rakeParallelGraph(seed);
			
			return seed;
		}
		
		/**
		 * Recursive function that digs through the parallel graph,
		 * and rakes all ExplicitParallels that are discovered.
		 */
		private rakeParallelGraph(par: Parallel)
		{
			for (const edgePar of par.getParallels())
				this.rakeParallelGraph(edgePar);
			
			if (par instanceof ExplicitParallel)
				this.rakeExplicitParallel(par);
		}
		
		/**
		 * Splitter method that rakes both a pattern and a non-pattern
		 * containing ExplicitParallel.
		 */
		private rakeExplicitParallel(par: ExplicitParallel)
		{
			if (this.rakedParallels.has(par))
				return par;
			
			this.rakedParallels.add(par);
			
			if (par.pattern)
				this.rakePatternBases(par);
			else
				this.rakeBaseGraph(par);
		}
		
		/**
		 * Recursively follows the bases of the specified source Node.
		 * Parallel instances are created for any visited Node instance
		 * that does not have one already created.
		 * Although the algorithm is careful to avoid circular bases, it's
		 * too early in the processing pipeline to report these circular
		 * bases as faults. This is because polymorphic name resolution
		 * needs to take place before the system can be sure that a 
		 * seemingly-circular base structure is in fact what it seems.
		 * True circular base detection is therefore handled at a future
		 * point in the pipeline.
		 */
		private rakeBaseGraph(srcParallel: ExplicitParallel)
		{
			if (srcParallel.pattern)
				throw Exception.unknownState();
			
			for (const hyperEdge of srcParallel.node.outbounds)
			{
				if (this.cruft.has(hyperEdge))
					continue;
				
				const possibilities = hyperEdge.successors
					.filter(scsr => !this.cruft.has(scsr.node))
					// Convert this to just use the length of the phrase directly.
					.sort((a, b) => a.longitude - b.longitude);
				
				if (possibilities.length > 0)
				{
					// This is where the polymorphic name resolution algorithm
					// takes place. The algorithm operates by working it's way
					// up the list of nodes (aka the scope chain), looking for
					// a possible resolution target where the act of applying the
					// associated Parallel as a base, causes at least one of the 
					// conditions on the contract to be satisfied. Or, in the case
					// when there are no conditions on the contract, the node
					// that is the closest ancestor is used.
					for (const possibleScsr of possibilities)
					{
						const possibleNode = possibleScsr.node;
						const baseParallel = this.drillFromNode(possibleNode);
						
						// baseParallel will be null in the case when a circular
						// relationship has been detected (and quitting is
						// required here in order to avoid a stack overflow).
						if (baseParallel === null)
							continue;
						
						this.rakeExplicitParallel(baseParallel);
						
						// There are cases when an entire parallel needs to be
						// "excavated", meaning that the Parallel's entire subtree
						// of contents needs to be analyzed and converted into
						// parallels. This is necessary because a fully defined set
						// of parallels is required in order to detect discrepant
						// unions (and therefore, report the attempt at a type
						// union as faulty).
						if (srcParallel.baseCount > 0)
						{
							if (srcParallel.baseCount === 1)
								this.excavate(srcParallel.firstBase);
							
							this.excavate(baseParallel);
						}
						
						if (!srcParallel.tryAddLiteralBase(baseParallel, hyperEdge))
							continue;
						
						if (this.handledHyperEdges.has(hyperEdge))
							throw Exception.unknownState();
						
						this.handledHyperEdges.add(hyperEdge);
						continue;
					}
				}
				else
				{
					// At this point, we've discovered an annotation that we're
					// going to try to resolve as an alias. If this doesn't work,
					// the edge will be marked as cruft. Possibly a future version
					// of this compiler will allow other agents to hook into this
					// process and augment the resolution strategy.
					
					const candidatePatternPars: ExplicitParallel[] = [];
					
					for (const { patternParallel } of this.ascend(srcParallel))
					{
						this.rakePatternBases(patternParallel);
						candidatePatternPars.push(patternParallel);
					}
					
					if (candidatePatternPars.length > 0)
					{
						const terms = hyperEdge.fragments
							.map(src => src.boundary.subject)
							.filter((v): v is Term => v instanceof Term);
						
						if (terms.length === 0)
							continue;
						
						const alias = terms[0].textContent;
						
						if (srcParallel.tryAddAliasedBase(candidatePatternPars, hyperEdge, alias))
						{
							this.handledHyperEdges.add(hyperEdge);
							continue;
						}
					}
					
					if (!this.handledHyperEdges.has(hyperEdge))
						this.cruft.add(hyperEdge, Faults.UnresolvedAnnotation);
				}
			}
			
			if (!srcParallel.isContractSatisfied)
				for (const smt of srcParallel.node.statements)
					this.program.faults.report(new Fault(
						Faults.ContractViolation,
						smt));
			
			return srcParallel;
		}
		
		/**
		 * Finds the set of bases that should be applied to the provided
		 * pattern-containing ExplicitParallel instance, and attempts
		 * to have them applied.
		 */
		private rakePatternBases(patternParallel: ExplicitParallel)
		{
			if (!patternParallel.pattern)
				throw Exception.unknownState();
			
			const bases = new Map<ExplicitParallel, HyperEdge>();
			const obs = patternParallel.node.outbounds;
			const nameOf = (edge: HyperEdge) =>
				Subject.serializeInternal(edge.fragments[0]);
			
			for (let i = -1; ++i < obs.length;)
			{
				const hyperEdge = obs[i];
				
				if (this.cruft.has(hyperEdge))
					continue;
				
				const len = hyperEdge.successors.length;
				
				// Because resolving pattern bases has non-polymorphic behavior, 
				// we can get away with checking for these faults here without going
				// through the whole drilling process.
				
				if (len === 0)
				{
					this.cruft.add(hyperEdge, Faults.UnresolvedAnnotation);
					continue;
				}
				
				if (obs.findIndex(e => nameOf(e) === nameOf(hyperEdge)) !== i)
				{
					this.cruft.add(hyperEdge, Faults.IgnoredAnnotation);
					continue;
				}
				
				if (len > 1)
					throw Exception.unknownState();
				
				const baseNode = hyperEdge.successors[0].node;
				const baseParallel = this.drillFromNode(baseNode);
				if (baseParallel !== null)
					bases.set(baseParallel, hyperEdge);
			}
			
			// Circular bases still need to be checked. It's unclear how and
			// where to actually do this, while factoring in the constraint
			// that these can be caused through the use of aliases.
			
			// Anything that is a list (with any dimensionality) needs to be
			// cut off, because these bases can't be applied to patterns.
			for (const [base, via] of bases)
				if (base.getListDimensionality() > 0)
					this.cruft.add(via, Faults.PatternMatchingList);
			
			// Now we need to determine if any of these bases are redundant.
			// This is done by checking to see if any of the bases are specified
			// somewhere in the base graph of all others.
			for (const [baseA] of bases)
				for (const [baseB, via] of bases)
					if (baseA !== baseB)
						if (baseA.hasBase(baseB))
							this.cruft.add(via, Faults.IgnoredAnnotation);
			
			const pattern = patternParallel.node.subject as Pattern;
			const span = patternParallel.node.declarations.values().next().value as Span;
			const portInfixes = pattern.getInfixes(InfixFlags.portability);
			
			if (portInfixes.length > 0)
			{
				const validPortabilityInfixes: Infix[] = [];
				
				for (const portInfix of portInfixes)
				{
					const nfxAnnosIter = span.eachAnnotationForInfix(portInfix);
					const nfxAnnos = Array.from(nfxAnnosIter);
					
					if (nfxAnnos.length === 0)
						throw Exception.unknownState();
					
					// At this time, we're currently generating a fault in the case when
					// a portability infix has multiple definitions. Although the parser
					// and the Graph-level infrastructure supports this, more study is
					// required in order to determine if this is a characteristic of Truth.
					if (nfxAnnos.length > 1)
					{
						for (const nfx of nfxAnnos.slice(1))
							this.cruft.add(nfx, Faults.PortabilityInfixHasUnion);
					}
					else validPortabilityInfixes.push(portInfix);
				}
				
				// This code checks for overlapping types. The algorithm used here is
				// similar to the redundant bases check used above. However, in the case
				// of infixes, these aren't just redundant, they would be problematic if
				// left in. To explain why, try to figure out how a String type would draw
				// it's data out of an alias matching the following pattern:
				// 	/< : Email>< : String> : Type
				// (hint: it doesn't work)
				
				//! Not implemented
			}
			
			// TODO: Check for use of lists within any kind of infix.
			// It's possible for no collected bases to be returned
			// in the case when there were actually annotations
			// specified within the file, but they were all found to
			// be cruft.
			if (bases.size === 0)
				return;
			
			patternParallel.tryApplyPatternBases(bases);
		}
		
		/**
		 * A generator function that works its way upwards, starting at the
		 * provided ExplicitParallel. The function yields the series of
		 * Parallels that contain Patterns that are visible to the provided
		 * srcParallel. The bases of these parallels have not necessarily
		 * been applied.
		 * 
		 * The ordering of the Parallels yielded is relevant. The instances
		 * that were yielded closer to the beginning take prescedence over
		 * the ones yielded at the end.
		 */
		private *ascend(srcParallel: ExplicitParallel)
		{
			const discoveredPatternNodes = new Set<Node>();
			
			const yieldable = (patternNode: Node) =>
			{
				discoveredPatternNodes.add(patternNode);
				
				return Not.null(
					this.parallels.get(patternNode) ||
					this.parallels.create(patternNode, this.cruft));
			};
			
			function *recurse(current: ExplicitParallel): 
				IterableIterator<IPatternParallel>
			{
				for (const { base } of current.eachBase())
					yield *recurse(base);
				
				if (current instanceof ExplicitParallel)
					for (const node of current.node.contents.values())
						if (node.subject instanceof Pattern)
							if (!discoveredPatternNodes.has(node))
								yield {
									pattern: node.subject,
									patternParallel: yieldable(node)
								};
			}
			
			// The process starts at the container of the current parallel,
			// even though this function needs to yield other parallels that
			// are adjacent to srcParallel, because we reach back into the
			// adjacents from the container.
			for (let current = srcParallel.container;
				current instanceof ExplicitParallel;)
			{
				yield *recurse(current);
				current = current.container;
			}
			// TODO
			debugger;
			for (const phrase of Phrase.rootsOf(srcParallel.node.document))
				if (phrase.terminal instanceof Pattern)
					if (!discoveredPatternNodes.has("phrase.associatedNode" as any))
						yield {
							pattern: phrase.terminal,
							patternParallel: yieldable("phrase.associatedNode" as any)
						};
		}
		
		/**
		 * Used for safety purposes to catch unexpected behavior.
		 */
		private readonly handledHyperEdges = new WeakSet<HyperEdge>();
		
		/**
		 * Constructs and returns a new seed Parallel from the specified
		 * zenith Parallel, navigating downwards to the specified target subject.
		 */
		private descend(zenith: Parallel, targetSubject: Subject)
		{
			/**
			 * @returns A new Parallel (either being a ExplicitParallel
			 * or an ImplicitParallel instance), that corresponds to
			 * the specified zenith parallel.
			 */
			const descendOne = (zenith: Parallel): Parallel =>
			{
				if (zenith instanceof ExplicitParallel)
				{
					const nextNode = zenith.node.contents.get(targetSubject);
					if (nextNode)
					{
						const out = this.parallels.get(nextNode) ||
							this.parallels.create(nextNode, this.cruft);
						
						this.verifyDescend(zenith, out);
						return out;
					}
				}
				/*
				TODO
				const nextPhrase = zenith.phrase.forward(targetSubject);
				*/
				debugger;
				const nextPhrase = null as any;
				return (
					this.parallels.get(nextPhrase) ||
					this.parallels.create(nextPhrase));
			};
			
			/**
			 * @returns A boolean value that indicates whether the act
			 * of descending from the specified Parallel to the typeName
			 * passed to the containing method is going to result in a
			 * ExplicitParallel instance.
			 */
			function canDescendToExplicit(parallel: Parallel)
			{
				return (
					parallel instanceof ExplicitParallel &&
					parallel.node.contents.has(targetSubject));
			}
			
			//
			// TODO: These functions can probably be replaced with
			// a call to Misc.reduceRecursive()
			//
			
			function *recurseParallels(par: Parallel): IterableIterator<Parallel>
			{
				for (const parEdge of par.getParallels())
					yield *recurseParallels(parEdge);
				
				yield par;
			}
			
			function *recurseBases(par: ExplicitParallel): IterableIterator<Parallel>
			{
				for (const { base } of par.eachBase())
					yield *recurseBases(base);
				
				yield par;
			}
			
			function *recurse(par: Parallel): IterableIterator<Parallel>
			{
				for (const parallelEdge of recurseParallels(par))
				{
					if (parallelEdge instanceof ExplicitParallel)
						for (const baseEdge of recurseBases(parallelEdge))
							yield baseEdge;
					
					yield parallelEdge;
				}
			}
			
			// The following algorithm performs a recursive reduction on
			// the zenith, and produces a set of Parallels to prune from the
			// descension process. The Parallels that end up getting pruned
			// are the ones that, if unpruned, would result in a layer that
			// has ImplicitParallels that shouldn't actually exist. For
			// example, consider the following document:
			//
			// Class
			// 
			// SubClass : Class
			// 	Child
			// 
			// "Class" should not have an ImplicitParallel called "Child",
			// because that was introduced in the derived "SubClass" type.
			// And so this algorithm stakes out cut off points so that we don't
			// blindly just descend all Parallels in the layer.
			const prunedParallels = new Set<Parallel>();
			
			const pruneParallelsFollowFn = (par: Parallel) =>
			{
				const upperParallels = par.getParallels().slice();
				if (par instanceof ExplicitParallel)
					for (const { base } of par.eachBase())
						upperParallels.push(base);
				
				return upperParallels;
			};
			
			const hasExplicitContents = Misc.reduceRecursive(
				zenith,
				pruneParallelsFollowFn,
				(current, results: readonly boolean[]) =>
				{
					const prune = 
						results.every(result => !result) &&
						!canDescendToExplicit(current);
					
					if (prune)
						prunedParallels.add(current);
					
					return !prune;
				});
			
			// In the case when the method is attempting to descend
			// to a level where there are no nodes whose name match
			// the type name specified (i.e. the whole layer would be 
			// implicit parallels), null is returned because a descend
			// wouldn't make sense.
			if (!hasExplicitContents)
				return null;
			
			const descendParallelsFollowFn = (par: Parallel) =>
			{
				if (!(par instanceof ExplicitParallel))
					return [];
				
				const bases = Array.from(par.eachBase())
					.map(entry => entry.base as Parallel)
					.slice();
				
				const result = bases
					.concat(par.getParallels())
					.filter(par => !prunedParallels.has(par));
				
				return result;
			};
			
			const seed = Misc.reduceRecursive(
				zenith,
				descendParallelsFollowFn,
				(current, nested: readonly Parallel[]) =>
				{
					const nextPar = descendOne(current);
					
					for (const edge of nested)
						nextPar.addParallel(edge);
					
					return nextPar;
				});
			
			return seed;
		}
		
		/**
		 * Performs verification on the descend operation.
		 * Reports any faults that can occur during this process.
		 */
		private verifyDescend(
			zenithParallel: ExplicitParallel,
			descendParallel: ExplicitParallel)
		{
			if (descendParallel.node.subject instanceof Anon)
				if (zenithParallel.isListIntrinsic)
					this.program.faults.report(new Fault(
						Faults.AnonymousInListIntrinsic,
						descendParallel.node.statements[0]));
		}
		
		/** */
		private readonly parallels = new ParallelCache();
		
		/**
		 * Stores the set of Parallel instances that have been "raked",
		 * which means that that have gone through the process of
		 * having their requested bases applied.
		 * 
		 * This set may include both pattern and non-patterns Parallels,
		 * (even though their raking processes are completely different).
		 */
		private readonly rakedParallels = new WeakSet<Parallel>();
		
		/** */
		private readonly cruft: CruftCache;
	}
	
	/** */
	interface IPatternParallel
	{
		readonly pattern: Pattern;
		readonly patternParallel: ExplicitParallel;
	}
	
	/** */
	export type TBaseTable = ReadonlyMap<ExplicitParallel, HyperEdge>;
}
