package com.eqms;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.UserUiPreferenceController;
import com.eqms.entity.UserAccount;
import com.eqms.entity.UserUiPreference;
import com.eqms.repository.UserUiPreferenceRepository;
import com.eqms.service.UserUiPreferenceService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserUiPreferenceServiceTest {

    private static final UUID ADA = UUID.fromString("00000000-0000-0000-0000-00000000000a");
    private static final String KEY = UserUiPreferenceService.NOTIFICATION_DOCK;

    @Mock UserUiPreferenceRepository repository;
    @Mock CurrentUserService currentUserService;
    @Mock UserAccount currentUser;

    private final ObjectMapper mapper = new ObjectMapper();

    private UserUiPreferenceService service() {
        return new UserUiPreferenceService(repository, mapper);
    }

    @Test
    void aNewPreferenceIsStoredForThatUserAndKeyOnly() throws Exception {
        when(repository.findByUserIdAndPrefKey(ADA, KEY)).thenReturn(Optional.empty());

        var saved = service().save(ADA, KEY, mapper.readTree("{\"pinned\":true}"));

        ArgumentCaptor<UserUiPreference> row = ArgumentCaptor.forClass(UserUiPreference.class);
        verify(repository).save(row.capture());
        assertThat(row.getValue().getUserId()).isEqualTo(ADA);
        assertThat(row.getValue().getPrefKey()).isEqualTo(KEY);
        assertThat(mapper.readTree(row.getValue().getValue()).get("pinned").asBoolean()).isTrue();
        assertThat(row.getValue().getUpdatedAt()).isNotNull();
        assertThat(saved.get("pinned").asBoolean()).isTrue();
    }

    @Test
    void savingAgainChangesTheExistingRowInsteadOfAddingOne() throws Exception {
        UserUiPreference existing = new UserUiPreference();
        existing.setId(UUID.randomUUID());
        existing.setUserId(ADA);
        existing.setPrefKey(KEY);
        existing.setValue("{\"pinned\":true}");
        when(repository.findByUserIdAndPrefKey(ADA, KEY)).thenReturn(Optional.of(existing));

        service().save(ADA, KEY, mapper.readTree("{\"pinned\":false}"));

        verify(repository).save(existing);
        assertThat(mapper.readTree(existing.getValue()).get("pinned").asBoolean()).isFalse();
    }

    @Test
    void whatIsReadIsWhatWasStored_andNothingStoredIsEmpty() throws Exception {
        UserUiPreference row = new UserUiPreference();
        row.setValue("{\"pinned\":true}");
        when(repository.findByUserIdAndPrefKey(ADA, KEY)).thenReturn(Optional.of(row));
        assertThat(service().find(ADA, KEY)).hasValueSatisfying(value -> assertThat(value.get("pinned").asBoolean()).isTrue());

        UUID other = UUID.randomUUID();
        when(repository.findByUserIdAndPrefKey(other, KEY)).thenReturn(Optional.empty());
        assertThat(service().find(other, KEY)).isEmpty();
    }

    @Test
    void aCorruptStoredRowReadsAsAnEmptyObjectInsteadOfBreakingTheScreen() {
        UserUiPreference row = new UserUiPreference();
        row.setValue("{not json");
        when(repository.findByUserIdAndPrefKey(ADA, KEY)).thenReturn(Optional.of(row));

        assertThat(service().find(ADA, KEY)).hasValueSatisfying(value -> assertThat(value.isObject() && value.isEmpty()).isTrue());
    }

    @Test
    void onlyKnownKeysExist() throws Exception {
        for (String key : new String[] {"theme", "notification-dock/x", "", "NOTIFICATION-DOCK"}) {
            assertThatThrownBy(() -> service().save(ADA, key, mapper.readTree("{\"pinned\":true}")), key).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service().find(ADA, key), key).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service().reset(ADA, key), key).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> service().find(ADA, null)).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void theValueMustBeExactlyAPinnedFlag() throws Exception {
        for (String json : new String[] {"true", "[]", "\"pinned\"", "{}", "{\"pinned\":\"yes\"}", "{\"pinned\":1}", "{\"pinned\":null}",
                "{\"pinned\":true,\"width\":500}", "{\"width\":500}"}) {
            assertThatThrownBy(() -> service().save(ADA, KEY, mapper.readTree(json)), json).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(() -> service().save(ADA, KEY, null)).isInstanceOf(IllegalArgumentException.class);
        verify(repository, never()).save(any());
    }

    @Test
    void sidebarFavouritesKeepTheListInOrderForThatUser() throws Exception {
        String key = UserUiPreferenceService.SIDEBAR_FAVORITES;
        when(repository.findByUserIdAndPrefKey(ADA, key)).thenReturn(Optional.empty());

        var saved = service().save(ADA, key, mapper.readTree("{\"ids\":[\"b\",\"a\"]}"));

        ArgumentCaptor<UserUiPreference> row = ArgumentCaptor.forClass(UserUiPreference.class);
        verify(repository).save(row.capture());
        assertThat(row.getValue().getUserId()).isEqualTo(ADA);
        assertThat(row.getValue().getPrefKey()).isEqualTo(key);
        assertThat(mapper.readTree(row.getValue().getValue()).get("ids")).extracting(n -> n.asText()).containsExactly("b", "a");
        assertThat(saved.get("ids")).hasSize(2);
        service().save(ADA, key, mapper.readTree("{\"ids\":[]}")); // clearing every favourite is allowed
    }

    @Test
    void sidebarFavouritesRefuseAnyOtherShape() throws Exception {
        String key = UserUiPreferenceService.SIDEBAR_FAVORITES;
        String tooMany = "{\"ids\":[" + java.util.stream.IntStream.range(0, 201).mapToObj(i -> "\"m" + i + "\"").collect(java.util.stream.Collectors.joining(",")) + "]}";
        String tooLong = "{\"ids\":[\"" + "x".repeat(101) + "\"]}";
        for (String json : new String[] {"[]", "{}", "{\"ids\":\"a\"}", "{\"ids\":[1]}", "{\"ids\":[null]}", "{\"ids\":[\"\"]}", "{\"ids\":[\" \"]}",
                "{\"ids\":[\"a\",\"a\"]}", "{\"ids\":[],\"x\":1}", tooMany, tooLong}) {
            assertThatThrownBy(() -> service().save(ADA, key, mapper.readTree(json)), json).isInstanceOf(IllegalArgumentException.class);
        }
        verify(repository, never()).save(any());
    }

    @Test
    void resettingDeletesOnlyThatUsersRow() {
        UserUiPreference row = new UserUiPreference();
        when(repository.findByUserIdAndPrefKey(ADA, KEY)).thenReturn(Optional.of(row));

        service().reset(ADA, KEY);

        verify(repository).delete(row);
    }

    @Test
    void theControllerAlwaysActsOnTheSignedInUserAndTakesNoUserIdFromTheRequest() throws Exception {
        UUID signedIn = UUID.randomUUID();
        when(currentUserService.requireCurrentUser()).thenReturn(currentUser);
        when(currentUser.getId()).thenReturn(signedIn);
        when(repository.findByUserIdAndPrefKey(signedIn, KEY)).thenReturn(Optional.empty());
        UserUiPreferenceController controller = new UserUiPreferenceController(currentUserService, service(), mapper);

        var body = controller.get(KEY).getBody();
        controller.save(KEY, mapper.readTree("{\"pinned\":true}"));
        controller.reset(KEY);

        assertThat(body.isObject() && body.isEmpty()).isTrue(); // never customised: an empty object
        verify(repository, org.mockito.Mockito.times(3)).findByUserIdAndPrefKey(signedIn, KEY);
        verify(repository, never()).findByUserIdAndPrefKey(ADA, KEY);
    }
}
