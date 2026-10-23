# Nested data lists

DUETBlox’s Data lists extension adds nested immutable lists to the official Scratch runtime using explicit JSON text in normal variables. The original flat Scratch lists remain available. Save a reporter result in a variable to retain a change; operations return a new value. This is not Snap’s first-class list/function language.

Start with `data list from JSON [[21,22],[23,24]]`, save it as `table`, then put `item 2 of data list table` inside `item 1 of data list …`: the result is 23. A downloadable, original example is in Blocks → Watch values. Nested values survive normal .sb3 and .duet saving because they are ordinary variable strings.

Use JSON to distinguish numbers, text, true/false and null. A text argument remains text; an ordinary numeric reporter remains a number. An item starting with `[` is parsed as another list. Operations reject objects, malformed JSON, nonfinite numbers, indices outside the list, more than 2,000 total values, more than 12 nesting levels or text over 24,000 characters. No input is evaluated as JavaScript. These blocks run in the browser and are not in the Arduino compiler subset.
