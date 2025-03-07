sort package:base R Documentation

## Sorting or Ordering Vectors

## Description:

Sort (or _order_) a vector or factor (partially) into ascending or  
descending order. For ordering along more than one variable,  
e.g., for sorting data frames, see ‘order’.

## Usage:

```r
sort(x, decreasing = FALSE, ...)
## Default S3 method:
sort(x, decreasing = FALSE, na.last = NA, ...)
sort.int(x, partial = NULL, na.last = NA, decreasing = FALSE,
         method = c("auto", "shell", "quick", "radix"), index.return = FALSE)
```

## Arguments:

x: for ‘sort’ an R object with a class or a numeric, complex,  
 character or logical vector. For ‘sort.int’, a numeric,  
 complex, character or logical vector, or a factor.

decreasing: logical. Should the sort be increasing or decreasing? Not  
 available for partial sorting.

...: arguments to be passed to or from methods or (for the default  
 methods and objects without a class) to ‘sort.int’.

na.last: for controlling the treatment of ‘NA’s. If ‘TRUE’, missing  
 values in the data are put last; if ‘FALSE’, they are put  
 first; if ‘NA’, they are removed.

partial: ‘NULL’ or a vector of indices for partial sorting.

method: character string specifying the algorithm used. Not  
 available for partial sorting. Can be abbreviated.

index.return: logical indicating if the ordering index vector should be  
 returned as well. Supported by ‘method == "radix"’ for any  
 ‘na.last’ mode and data type, and the other methods when  
 ‘na.last = NA’ (the default) and fully sorting non-factors.

## Details:

‘sort’ is a generic function for which methods can be written, and  
‘sort.int’ is the internal method which is compatible with S if  
only the first three arguments are used.

The default ‘sort’ method makes use of ‘order’ for classed  
objects, which in turn makes use of the generic function ‘xtfrm’  
(and can be slow unless a ‘xtfrm’ method has been defined or  
‘is.numeric(x)’ is true).

Complex values are sorted first by the real part, then the  
imaginary part.

The ‘"auto"’ method selects ‘"radix"’ for short (less than 2^31  
elements) numeric vectors, integer vectors, logical vectors and  
factors; otherwise, ‘"shell"’.

Except for method ‘"radix"’, the sort order for character vectors  
will depend on the collating sequence of the locale in use: see  
‘Comparison’. The sort order for factors is the order of their  
levels (which is particularly appropriate for ordered factors).

If ‘partial’ is not ‘NULL’, it is taken to contain indices of  
elements of the result which are to be placed in their correct  
positions in the sorted array by partial sorting. For each of the  
result values in a specified position, any values smaller than  
that one are guaranteed to have a smaller index in the sorted  
array and any values which are greater are guaranteed to have a  
bigger index in the sorted array. (This is included for  
efficiency, and many of the options are not available for partial  
sorting. It is only substantially more efficient if ‘partial’ has  
a handful of elements, and a full sort is done (a Quicksort if  
possible) if there are more than 10.) Names are discarded for  
partial sorting.

Method ‘"shell"’ uses Shellsort (an O(n^{4/3}) variant from  
Sedgewick (1986)). If ‘x’ has names a stable modification is  
used, so ties are not reordered. (This only matters if names are  
present.)

Method ‘"quick"’ uses Singleton (1969)'s implementation of Hoare's  
Quicksort method and is only available when ‘x’ is numeric (double  
or integer) and ‘partial’ is ‘NULL’. (For other types of ‘x’  
Shellsort is used, silently.) It is normally somewhat faster than  
Shellsort (perhaps 50% faster on vectors of length a million and  
twice as fast at a billion) but has poor performance in the rare  
worst case. (Peto's modification using a pseudo-random midpoint  
is used to make the worst case rarer.) This is not a stable sort,  
and ties may be reordered.

Method ‘"radix"’ relies on simple hashing to scale time linearly  
with the input size, i.e., its asymptotic time complexity is O(n).  
The specific variant and its implementation originated from the  
data.table package and are due to Matt Dowle and Arun Srinivasan.  
For small inputs (< 200), the implementation uses an insertion  
sort (O(n^2)) that operates in-place to avoid the allocation  
overhead of the radix sort. For integer vectors of range less than  
100,000, it switches to a simpler and faster linear time counting  
sort. In all cases, the sort is stable; the order of ties is  
preserved. It is the default method for integer vectors and  
factors.

The ‘"radix"’ method generally outperforms the other methods,  
especially for small integers. Compared to quick sort, it is  
slightly faster for vectors with large integer or real values (but  
unlike quick sort, radix is stable and supports all ‘na.last’  
options). The implementation is orders of magnitude faster than  
shell sort for character vectors, but collation _does not respect  
the locale_ and so gives incorrect answers even in English  
locales.

However, there are some caveats for the radix sort:

• If ‘x’ is a ‘character’ vector, all elements must share the  
 same encoding. Only UTF-8 (including ASCII) and Latin-1  
 encodings are supported. Collation follows that with  
 ‘LC_COLLATE=C’, that is lexicographically byte-by-byte using  
 numerical ordering of bytes.

• Long vectors (with 2^31 or more elements) and ‘complex’  
 vectors are not supported.

## Value:

For ‘sort’, the result depends on the S3 method which is  
dispatched. If ‘x’ does not have a class ‘sort.int’ is used and  
it description applies. For classed objects which do not have a  
specific method the default method will be used and is equivalent  
to ‘x[order(x, ...)]’: this depends on the class having a suitable  
method for ‘[’ (and also that ‘order’ will work, which requires a  
‘xtfrm’ method).

For ‘sort.int’ the value is the sorted vector unless  
‘index.return’ is true, when the result is a list with components  
named ‘x’ and ‘ix’ containing the sorted numbers and the ordering  
index vector. In the latter case, if ‘method == "quick"’ ties may  
be reversed in the ordering (unlike ‘sort.list’) as quicksort is  
not stable. For ‘method == "radix"’, ‘index.return’ is supported  
for all ‘na.last’ modes. The other methods only support  
‘index.return’ when ‘na.last’ is ‘NA’. The index vector refers to  
element numbers _after removal of ‘NA’s_: see ‘order’ if you want  
the original element numbers.

All attributes are removed from the return value (see Becker _et  
al_, 1988, p.146) except names, which are sorted. (If ‘partial’  
is specified even the names are removed.) Note that this means  
that the returned value has no class, except for factors and  
ordered factors (which are treated specially and whose result is  
transformed back to the original class).

## References:

Becker, R. A., Chambers, J. M. and Wilks, A. R. (1988). _The New  
S Language_. Wadsworth & Brooks/Cole.

Knuth, D. E. (1998). _The Art of Computer Programming, Volume 3:  
Sorting and Searching_, 2nd ed. Addison-Wesley.

Sedgewick, R. (1986). A new upper bound for Shellsort. _Journal  
of Algorithms_, _7_, 159-173. doi:10.1016/0196-6774(86)90001-5  
<HTTPS://doi.org/10.1016/0196-6774%2886%2990001-5>.

Singleton, R. C. (1969). Algorithm 347: an efficient algorithm  
for sorting with minimal storage. _Communications of the ACM_,  
_12_, 185-186. doi:10.1145/362875.362901  
<HTTPS://doi.org/10.1145/362875.362901>.

## See Also:

‘Comparison’ for how character strings are collated.

‘order’ for sorting on or reordering multiple variables.

‘is.unsorted’. ‘rank’.

## Examples:

```r
require(stats)
x <- swiss$Education[1:25]
x; sort(x); sort(x, partial = c(10, 15))
## illustrate 'stable' sorting (of ties):
sort(c(10:3, 2:12), method = "shell", index.return = TRUE) # is stable
## $x : 2  3  3  4  4  5  5  6  6  7  7  8  8  9  9 10 10 11 12
## $ix: 9  8 10  7 11  6 12  5 13  4 14  3 15  2 16  1 17 18 19
sort(c(10:3, 2:12), method = "quick", index.return = TRUE) # is not
## $x : 2  3  3  4  4  5  5  6  6  7  7  8  8  9  9 10 10 11 12
## $ix: 9 10  8  7 11  6 12  5 13  4 14  3 15 16  2 17  1 18 19
x <- c(1:3, 3:5, 10)
is.unsorted(x)                  # FALSE: is sorted
is.unsorted(x, strictly = TRUE) # TRUE : is not (and cannot be)
                                # sorted strictly
## Not run:
## Small speed comparison simulation:
N <- 2000
Sim <- 20
rep <- 1000 # << adjust to your CPU
c1 <- c2 <- numeric(Sim)
for(is in seq_len(Sim)){
  x <- rnorm(N)
  c1[is] <- system.time(for(i in 1:rep) sort(x, method = "shell"))[1]
  c2[is] <- system.time(for(i in 1:rep) sort(x, method = "quick"))[1]
  stopifnot(sort(x, method = "shell") == sort(x, method = "quick"))
}
rbind(ShellSort = c1, QuickSort = c2)
cat("Speedup factor of quick sort():\n")
summary({qq <- c1 / c2; qq[is.finite(qq)]})
## A larger test
x <- rnorm(1e7)
system.time(x1 <- sort(x, method = "shell"))
system.time(x2 <- sort(x, method = "quick"))
system.time(x3 <- sort(x, method = "radix"))
stopifnot(identical(x1, x2))
stopifnot(identical(x1, x3))
## End(Not run)
```
