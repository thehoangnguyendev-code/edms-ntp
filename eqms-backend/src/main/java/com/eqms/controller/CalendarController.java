package com.eqms.controller;

import com.eqms.dto.calendar.*;
import com.eqms.service.CalendarService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.PositiveOrZero;
import org.springframework.http.*;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import java.util.UUID;

@RestController @RequestMapping("/calendar") @Validated
public class CalendarController {
    private final CalendarService service;
    public CalendarController(CalendarService service) { this.service = service; }
    @GetMapping
    public CalendarMonthResponse month(@RequestParam(required = false) String month,
                                       @RequestParam(defaultValue = "ALL") String source) { return service.month(month, source); }
    @PostMapping("/events") @ResponseStatus(HttpStatus.CREATED)
    public CalendarEventResponse create(@Valid @RequestBody CalendarEventRequest request) { return service.create(request); }
    @PutMapping("/events/{id}")
    public CalendarEventResponse update(@PathVariable UUID id, @Valid @RequestBody CalendarEventRequest request) { return service.update(id, request); }
    @DeleteMapping("/events/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id, @RequestParam @PositiveOrZero long version) { service.delete(id, version); }
}
