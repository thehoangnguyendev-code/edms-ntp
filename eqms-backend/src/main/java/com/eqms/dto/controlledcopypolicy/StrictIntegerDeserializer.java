package com.eqms.dto.controlledcopypolicy;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.exc.InvalidFormatException;

import java.io.IOException;

/** An integer setting must be a whole number: 50.5 is refused instead of being silently cut to 50. */
public class StrictIntegerDeserializer extends JsonDeserializer<Integer> {

    @Override
    public Integer deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        JsonToken token = parser.currentToken();
        if (token == JsonToken.VALUE_NUMBER_FLOAT) {
            throw InvalidFormatException.from(parser, "A whole number is required", parser.getText(), Integer.class);
        }
        return (Integer) context.getParser().getCodec().readValue(parser, Integer.class);
    }
}
