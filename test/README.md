Tests dont run nice end to end  

This works:

```bash
ls | while read FILE; do mocha $FILE; done
```

But you need to watch it. Doesn't report everything at the end.

Getting closer...
