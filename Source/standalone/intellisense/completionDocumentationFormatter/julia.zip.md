```julia
zip(iters...)
```

Run multiple iterators at the same time, until any of them is exhausted. The  
value type of the zip iterator is a tuple of values of its subiterators.

## Note:

│ zip orders the calls to its subiterators in such a way that  
│ stateful iterators will not advance when another iterator finishes  
│ in the current iteration.

See also: enumerate, splat.

## Examples:

```julia
julia> a = 1:5
1:5
julia> b = [\"e\",\"d\",\"b\",\"c\",\"a\"]
5-element Vector{String}:
 \"e\"
 \"d\"
 \"b\"
 \"c\"
 \"a\"
julia> c = zip(a,b)
zip(1:5, [\"e\", \"d\", \"b\", \"c\", \"a\"])
julia> length(c)
5
julia> first(c)
(1, \"e\")
```
