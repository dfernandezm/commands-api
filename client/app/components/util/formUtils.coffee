formUtils = module.exports = {}

formUtils.fillForm = (fields, target) ->
  for field in fields
    field.value = target[field.name]
  return

formUtils.collectValues = (fields, target) ->
  for field in fields
    value = field.value

    if field.type is 'BOOLEAN' && field.value == null
      value = false
    
    target[field.name] = value
  return

formUtils.clearForm = (fields) ->
  for field in fields
    field.value = null
  return
