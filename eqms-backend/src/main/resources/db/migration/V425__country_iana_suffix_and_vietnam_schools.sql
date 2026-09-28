-- Countries: add IANA (ccTLD) suffix, shown as a plain-text column on the Countries
-- screen (no badge).
ALTER TABLE countries ADD COLUMN iana_suffix VARCHAR(10);

UPDATE countries SET iana_suffix = '.af' WHERE name = 'Afghanistan';
UPDATE countries SET iana_suffix = '.al' WHERE name = 'Albania';
UPDATE countries SET iana_suffix = '.dz' WHERE name = 'Algeria';
UPDATE countries SET iana_suffix = '.ad' WHERE name = 'Andorra';
UPDATE countries SET iana_suffix = '.ao' WHERE name = 'Angola';
UPDATE countries SET iana_suffix = '.ag' WHERE name = 'Antigua and Barbuda';
UPDATE countries SET iana_suffix = '.ar' WHERE name = 'Argentina';
UPDATE countries SET iana_suffix = '.am' WHERE name = 'Armenia';
UPDATE countries SET iana_suffix = '.au' WHERE name = 'Australia';
UPDATE countries SET iana_suffix = '.at' WHERE name = 'Austria';
UPDATE countries SET iana_suffix = '.az' WHERE name = 'Azerbaijan';
UPDATE countries SET iana_suffix = '.bs' WHERE name = 'Bahamas';
UPDATE countries SET iana_suffix = '.bh' WHERE name = 'Bahrain';
UPDATE countries SET iana_suffix = '.bd' WHERE name = 'Bangladesh';
UPDATE countries SET iana_suffix = '.bb' WHERE name = 'Barbados';
UPDATE countries SET iana_suffix = '.by' WHERE name = 'Belarus';
UPDATE countries SET iana_suffix = '.be' WHERE name = 'Belgium';
UPDATE countries SET iana_suffix = '.bz' WHERE name = 'Belize';
UPDATE countries SET iana_suffix = '.bj' WHERE name = 'Benin';
UPDATE countries SET iana_suffix = '.bt' WHERE name = 'Bhutan';
UPDATE countries SET iana_suffix = '.bo' WHERE name = 'Bolivia';
UPDATE countries SET iana_suffix = '.ba' WHERE name = 'Bosnia and Herzegovina';
UPDATE countries SET iana_suffix = '.bw' WHERE name = 'Botswana';
UPDATE countries SET iana_suffix = '.br' WHERE name = 'Brazil';
UPDATE countries SET iana_suffix = '.bn' WHERE name = 'Brunei';
UPDATE countries SET iana_suffix = '.bg' WHERE name = 'Bulgaria';
UPDATE countries SET iana_suffix = '.bf' WHERE name = 'Burkina Faso';
UPDATE countries SET iana_suffix = '.bi' WHERE name = 'Burundi';
UPDATE countries SET iana_suffix = '.cv' WHERE name = 'Cabo Verde';
UPDATE countries SET iana_suffix = '.kh' WHERE name = 'Cambodia';
UPDATE countries SET iana_suffix = '.cm' WHERE name = 'Cameroon';
UPDATE countries SET iana_suffix = '.ca' WHERE name = 'Canada';
UPDATE countries SET iana_suffix = '.cf' WHERE name = 'Central African Republic';
UPDATE countries SET iana_suffix = '.td' WHERE name = 'Chad';
UPDATE countries SET iana_suffix = '.cl' WHERE name = 'Chile';
UPDATE countries SET iana_suffix = '.cn' WHERE name = 'China';
UPDATE countries SET iana_suffix = '.co' WHERE name = 'Colombia';
UPDATE countries SET iana_suffix = '.km' WHERE name = 'Comoros';
UPDATE countries SET iana_suffix = '.cg' WHERE name = 'Congo (Republic)';
UPDATE countries SET iana_suffix = '.cd' WHERE name = 'Congo (DRC)';
UPDATE countries SET iana_suffix = '.cr' WHERE name = 'Costa Rica';
UPDATE countries SET iana_suffix = '.hr' WHERE name = 'Croatia';
UPDATE countries SET iana_suffix = '.cu' WHERE name = 'Cuba';
UPDATE countries SET iana_suffix = '.cy' WHERE name = 'Cyprus';
UPDATE countries SET iana_suffix = '.cz' WHERE name = 'Czech Republic';
UPDATE countries SET iana_suffix = '.dk' WHERE name = 'Denmark';
UPDATE countries SET iana_suffix = '.dj' WHERE name = 'Djibouti';
UPDATE countries SET iana_suffix = '.dm' WHERE name = 'Dominica';
UPDATE countries SET iana_suffix = '.do' WHERE name = 'Dominican Republic';
UPDATE countries SET iana_suffix = '.ec' WHERE name = 'Ecuador';
UPDATE countries SET iana_suffix = '.eg' WHERE name = 'Egypt';
UPDATE countries SET iana_suffix = '.sv' WHERE name = 'El Salvador';
UPDATE countries SET iana_suffix = '.gq' WHERE name = 'Equatorial Guinea';
UPDATE countries SET iana_suffix = '.er' WHERE name = 'Eritrea';
UPDATE countries SET iana_suffix = '.ee' WHERE name = 'Estonia';
UPDATE countries SET iana_suffix = '.sz' WHERE name = 'Eswatini';
UPDATE countries SET iana_suffix = '.et' WHERE name = 'Ethiopia';
UPDATE countries SET iana_suffix = '.fj' WHERE name = 'Fiji';
UPDATE countries SET iana_suffix = '.fi' WHERE name = 'Finland';
UPDATE countries SET iana_suffix = '.fr' WHERE name = 'France';
UPDATE countries SET iana_suffix = '.ga' WHERE name = 'Gabon';
UPDATE countries SET iana_suffix = '.gm' WHERE name = 'Gambia';
UPDATE countries SET iana_suffix = '.ge' WHERE name = 'Georgia';
UPDATE countries SET iana_suffix = '.de' WHERE name = 'Germany';
UPDATE countries SET iana_suffix = '.gh' WHERE name = 'Ghana';
UPDATE countries SET iana_suffix = '.gr' WHERE name = 'Greece';
UPDATE countries SET iana_suffix = '.gd' WHERE name = 'Grenada';
UPDATE countries SET iana_suffix = '.gt' WHERE name = 'Guatemala';
UPDATE countries SET iana_suffix = '.gn' WHERE name = 'Guinea';
UPDATE countries SET iana_suffix = '.gw' WHERE name = 'Guinea-Bissau';
UPDATE countries SET iana_suffix = '.gy' WHERE name = 'Guyana';
UPDATE countries SET iana_suffix = '.ht' WHERE name = 'Haiti';
UPDATE countries SET iana_suffix = '.hn' WHERE name = 'Honduras';
UPDATE countries SET iana_suffix = '.hu' WHERE name = 'Hungary';
UPDATE countries SET iana_suffix = '.is' WHERE name = 'Iceland';
UPDATE countries SET iana_suffix = '.in' WHERE name = 'India';
UPDATE countries SET iana_suffix = '.id' WHERE name = 'Indonesia';
UPDATE countries SET iana_suffix = '.ir' WHERE name = 'Iran';
UPDATE countries SET iana_suffix = '.iq' WHERE name = 'Iraq';
UPDATE countries SET iana_suffix = '.ie' WHERE name = 'Ireland';
UPDATE countries SET iana_suffix = '.il' WHERE name = 'Israel';
UPDATE countries SET iana_suffix = '.it' WHERE name = 'Italy';
UPDATE countries SET iana_suffix = '.jm' WHERE name = 'Jamaica';
UPDATE countries SET iana_suffix = '.jp' WHERE name = 'Japan';
UPDATE countries SET iana_suffix = '.jo' WHERE name = 'Jordan';
UPDATE countries SET iana_suffix = '.kz' WHERE name = 'Kazakhstan';
UPDATE countries SET iana_suffix = '.ke' WHERE name = 'Kenya';
UPDATE countries SET iana_suffix = '.ki' WHERE name = 'Kiribati';
UPDATE countries SET iana_suffix = '.kw' WHERE name = 'Kuwait';
UPDATE countries SET iana_suffix = '.kg' WHERE name = 'Kyrgyzstan';
UPDATE countries SET iana_suffix = '.la' WHERE name = 'Laos';
UPDATE countries SET iana_suffix = '.lv' WHERE name = 'Latvia';
UPDATE countries SET iana_suffix = '.lb' WHERE name = 'Lebanon';
UPDATE countries SET iana_suffix = '.ls' WHERE name = 'Lesotho';
UPDATE countries SET iana_suffix = '.lr' WHERE name = 'Liberia';
UPDATE countries SET iana_suffix = '.ly' WHERE name = 'Libya';
UPDATE countries SET iana_suffix = '.li' WHERE name = 'Liechtenstein';
UPDATE countries SET iana_suffix = '.lt' WHERE name = 'Lithuania';
UPDATE countries SET iana_suffix = '.lu' WHERE name = 'Luxembourg';
UPDATE countries SET iana_suffix = '.mg' WHERE name = 'Madagascar';
UPDATE countries SET iana_suffix = '.mw' WHERE name = 'Malawi';
UPDATE countries SET iana_suffix = '.my' WHERE name = 'Malaysia';
UPDATE countries SET iana_suffix = '.mv' WHERE name = 'Maldives';
UPDATE countries SET iana_suffix = '.ml' WHERE name = 'Mali';
UPDATE countries SET iana_suffix = '.mt' WHERE name = 'Malta';
UPDATE countries SET iana_suffix = '.mh' WHERE name = 'Marshall Islands';
UPDATE countries SET iana_suffix = '.mr' WHERE name = 'Mauritania';
UPDATE countries SET iana_suffix = '.mu' WHERE name = 'Mauritius';
UPDATE countries SET iana_suffix = '.mx' WHERE name = 'Mexico';
UPDATE countries SET iana_suffix = '.fm' WHERE name = 'Micronesia';
UPDATE countries SET iana_suffix = '.md' WHERE name = 'Moldova';
UPDATE countries SET iana_suffix = '.mc' WHERE name = 'Monaco';
UPDATE countries SET iana_suffix = '.mn' WHERE name = 'Mongolia';
UPDATE countries SET iana_suffix = '.me' WHERE name = 'Montenegro';
UPDATE countries SET iana_suffix = '.ma' WHERE name = 'Morocco';
UPDATE countries SET iana_suffix = '.mz' WHERE name = 'Mozambique';
UPDATE countries SET iana_suffix = '.mm' WHERE name = 'Myanmar';
UPDATE countries SET iana_suffix = '.na' WHERE name = 'Namibia';
UPDATE countries SET iana_suffix = '.nr' WHERE name = 'Nauru';
UPDATE countries SET iana_suffix = '.np' WHERE name = 'Nepal';
UPDATE countries SET iana_suffix = '.nl' WHERE name = 'Netherlands';
UPDATE countries SET iana_suffix = '.nz' WHERE name = 'New Zealand';
UPDATE countries SET iana_suffix = '.ni' WHERE name = 'Nicaragua';
UPDATE countries SET iana_suffix = '.ne' WHERE name = 'Niger';
UPDATE countries SET iana_suffix = '.ng' WHERE name = 'Nigeria';
UPDATE countries SET iana_suffix = '.kp' WHERE name = 'North Korea';
UPDATE countries SET iana_suffix = '.mk' WHERE name = 'North Macedonia';
UPDATE countries SET iana_suffix = '.no' WHERE name = 'Norway';
UPDATE countries SET iana_suffix = '.om' WHERE name = 'Oman';
UPDATE countries SET iana_suffix = '.pk' WHERE name = 'Pakistan';
UPDATE countries SET iana_suffix = '.pw' WHERE name = 'Palau';
UPDATE countries SET iana_suffix = '.pa' WHERE name = 'Panama';
UPDATE countries SET iana_suffix = '.pg' WHERE name = 'Papua New Guinea';
UPDATE countries SET iana_suffix = '.py' WHERE name = 'Paraguay';
UPDATE countries SET iana_suffix = '.pe' WHERE name = 'Peru';
UPDATE countries SET iana_suffix = '.ph' WHERE name = 'Philippines';
UPDATE countries SET iana_suffix = '.pl' WHERE name = 'Poland';
UPDATE countries SET iana_suffix = '.pt' WHERE name = 'Portugal';
UPDATE countries SET iana_suffix = '.qa' WHERE name = 'Qatar';
UPDATE countries SET iana_suffix = '.ro' WHERE name = 'Romania';
UPDATE countries SET iana_suffix = '.ru' WHERE name = 'Russia';
UPDATE countries SET iana_suffix = '.rw' WHERE name = 'Rwanda';
UPDATE countries SET iana_suffix = '.kn' WHERE name = 'Saint Kitts and Nevis';
UPDATE countries SET iana_suffix = '.lc' WHERE name = 'Saint Lucia';
UPDATE countries SET iana_suffix = '.vc' WHERE name = 'Saint Vincent and the Grenadines';
UPDATE countries SET iana_suffix = '.ws' WHERE name = 'Samoa';
UPDATE countries SET iana_suffix = '.sm' WHERE name = 'San Marino';
UPDATE countries SET iana_suffix = '.st' WHERE name = 'Sao Tome and Principe';
UPDATE countries SET iana_suffix = '.sa' WHERE name = 'Saudi Arabia';
UPDATE countries SET iana_suffix = '.sn' WHERE name = 'Senegal';
UPDATE countries SET iana_suffix = '.rs' WHERE name = 'Serbia';
UPDATE countries SET iana_suffix = '.sc' WHERE name = 'Seychelles';
UPDATE countries SET iana_suffix = '.sl' WHERE name = 'Sierra Leone';
UPDATE countries SET iana_suffix = '.sg' WHERE name = 'Singapore';
UPDATE countries SET iana_suffix = '.sk' WHERE name = 'Slovakia';
UPDATE countries SET iana_suffix = '.si' WHERE name = 'Slovenia';
UPDATE countries SET iana_suffix = '.sb' WHERE name = 'Solomon Islands';
UPDATE countries SET iana_suffix = '.so' WHERE name = 'Somalia';
UPDATE countries SET iana_suffix = '.za' WHERE name = 'South Africa';
UPDATE countries SET iana_suffix = '.kr' WHERE name = 'South Korea';
UPDATE countries SET iana_suffix = '.ss' WHERE name = 'South Sudan';
UPDATE countries SET iana_suffix = '.es' WHERE name = 'Spain';
UPDATE countries SET iana_suffix = '.lk' WHERE name = 'Sri Lanka';
UPDATE countries SET iana_suffix = '.sd' WHERE name = 'Sudan';
UPDATE countries SET iana_suffix = '.sr' WHERE name = 'Suriname';
UPDATE countries SET iana_suffix = '.se' WHERE name = 'Sweden';
UPDATE countries SET iana_suffix = '.ch' WHERE name = 'Switzerland';
UPDATE countries SET iana_suffix = '.sy' WHERE name = 'Syria';
UPDATE countries SET iana_suffix = '.tw' WHERE name = 'Taiwan';
UPDATE countries SET iana_suffix = '.tj' WHERE name = 'Tajikistan';
UPDATE countries SET iana_suffix = '.tz' WHERE name = 'Tanzania';
UPDATE countries SET iana_suffix = '.th' WHERE name = 'Thailand';
UPDATE countries SET iana_suffix = '.tl' WHERE name = 'Timor-Leste';
UPDATE countries SET iana_suffix = '.tg' WHERE name = 'Togo';
UPDATE countries SET iana_suffix = '.to' WHERE name = 'Tonga';
UPDATE countries SET iana_suffix = '.tt' WHERE name = 'Trinidad and Tobago';
UPDATE countries SET iana_suffix = '.tn' WHERE name = 'Tunisia';
UPDATE countries SET iana_suffix = '.tr' WHERE name = 'Turkey';
UPDATE countries SET iana_suffix = '.tm' WHERE name = 'Turkmenistan';
UPDATE countries SET iana_suffix = '.tv' WHERE name = 'Tuvalu';
UPDATE countries SET iana_suffix = '.ug' WHERE name = 'Uganda';
UPDATE countries SET iana_suffix = '.ua' WHERE name = 'Ukraine';
UPDATE countries SET iana_suffix = '.ae' WHERE name = 'United Arab Emirates';
UPDATE countries SET iana_suffix = '.uk' WHERE name = 'United Kingdom';
UPDATE countries SET iana_suffix = '.us' WHERE name = 'United States';
UPDATE countries SET iana_suffix = '.uy' WHERE name = 'Uruguay';
UPDATE countries SET iana_suffix = '.uz' WHERE name = 'Uzbekistan';
UPDATE countries SET iana_suffix = '.vu' WHERE name = 'Vanuatu';
UPDATE countries SET iana_suffix = '.va' WHERE name = 'Vatican City';
UPDATE countries SET iana_suffix = '.ve' WHERE name = 'Venezuela';
UPDATE countries SET iana_suffix = '.vn' WHERE name = 'Vietnam';
UPDATE countries SET iana_suffix = '.ye' WHERE name = 'Yemen';
UPDATE countries SET iana_suffix = '.zm' WHERE name = 'Zambia';
UPDATE countries SET iana_suffix = '.zw' WHERE name = 'Zimbabwe';

-- Education > Schools: abbreviation + ownership, and the real seed data from
-- vietnam_education_institutions_final_2026.json (Bo GD&DT-cross-checked public source,
-- 2026-09-16). institution_type mapped onto the existing SchoolType enum:
-- dai_hoc/truong_dai_hoc/co_so_nuoc_ngoai -> UNIVERSITY, hoc_vien -> ACADEMY,
-- cao_dang -> COLLEGE, trung_cap -> VOCATIONAL_SECONDARY, trung_tam_gdnn -> TRADE_SCHOOL.
ALTER TABLE schools ADD COLUMN abbreviation VARCHAR(40);
ALTER TABLE schools ADD COLUMN ownership VARCHAR(40);

INSERT INTO schools (name, abbreviation, type, ownership) VALUES
    ('Đại học Bách khoa Hà Nội', 'HUST', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Cần Thơ', 'CTU', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Công nghiệp Hà Nội', 'HaUI', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Công nghiệp Thành phố Hồ Chí Minh', 'IUH', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Đà Nẵng', 'UDN', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Duy Tân', 'DTU', 'UNIVERSITY', 'PRIVATE'),
    ('Đại học Huế', 'HU', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Kinh tế Quốc dân', 'NEU', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Kinh tế Thành phố Hồ Chí Minh', 'UEH', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Quốc gia Hà Nội', 'VNU', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Quốc gia Thành phố Hồ Chí Minh', 'VNU-HCM', 'UNIVERSITY', 'PUBLIC'),
    ('Đại học Thái Nguyên', 'TNU', 'UNIVERSITY', 'PUBLIC'),
    ('Học viện Báo chí và Tuyên truyền', 'AJC', 'ACADEMY', 'PUBLIC'),
    ('Học viện Chính sách và Phát triển', 'APD', 'ACADEMY', 'PUBLIC'),
    ('Học viện Công nghệ Bưu chính Viễn thông', 'PTIT', 'ACADEMY', 'PUBLIC'),
    ('Học viện Hành chính và Quản trị công', 'NAPA', 'ACADEMY', 'PUBLIC'),
    ('Học viện Ngân hàng', 'BA', 'ACADEMY', 'PUBLIC'),
    ('Học viện Ngoại giao', 'DAV', 'ACADEMY', 'PUBLIC'),
    ('Học viện Nông nghiệp Việt Nam', 'VNUA', 'ACADEMY', 'PUBLIC'),
    ('Học viện Phụ nữ Việt Nam', 'VWA', 'ACADEMY', 'PUBLIC'),
    ('Học viện Quản lý Giáo dục', 'NAEM', 'ACADEMY', 'PUBLIC'),
    ('Học viện Tài chính', 'AOF', 'ACADEMY', 'PUBLIC'),
    ('Học viện Thanh thiếu niên Việt Nam', 'VYA', 'ACADEMY', 'PUBLIC'),
    ('Học viện Tòa án', 'VCA', 'ACADEMY', 'PUBLIC'),
    ('Trường Đại học An Giang - ĐHQG Thành phố Hồ Chí Minh', 'AGU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Bà Rịa - Vũng Tàu', 'BVU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Bạc Liêu', 'BLU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Bách khoa - Đại học Đà Nẵng', 'DUT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Bách khoa - ĐHQG Thành phố Hồ Chí Minh', 'HCMUT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Bình Dương', 'BDU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học CMC', 'CMCU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghệ - ĐHQG Hà Nội', 'VNU-UET', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công nghệ Đông Á', 'EAUT', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghệ Đồng Nai', 'DNTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghệ Giao thông Vận tải', 'UTT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công nghệ Sài Gòn', 'STU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghệ Thành phố Hồ Chí Minh', 'HUTECH', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghệ Thông tin - ĐHQG Thành phố Hồ Chí Minh', 'UIT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công nghệ Thông tin và Truyền thông - Đại học Thái Nguyên', 'ICTU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công nghệ Thông tin và Truyền thông Việt - Hàn - Đại học Đà Nẵng', 'VKU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công nghệ và Quản lý Hữu nghị', 'UTM', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Công nghiệp Việt - Hung', 'VIU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Công Thương Thành phố Hồ Chí Minh', 'HUIT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Cửu Long', 'MKU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Đà Lạt', 'DLU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Đại Nam', 'DNU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Điện lực', 'EPU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Đông Á', 'UDA', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Đông Đô', 'HDIU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Đồng Tháp', 'DThU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Dược Hà Nội', 'HUP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học FPT', 'FPTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Gia Định', 'GDU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Giáo dục - ĐHQG Hà Nội', 'VNU-UEd', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Giao thông Vận tải', 'UTC', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Giao thông Vận tải Thành phố Hồ Chí Minh', 'UTH', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hạ Long', 'UHL', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hà Nội', 'HANU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hải Dương', 'UHD', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hải Phòng', 'DHHP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hòa Bình', 'HBU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Hoa Lư', 'HLUV', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hoa Sen', 'HSU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Hồng Đức', 'HDU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hùng Vương', 'HVU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Hùng Vương Thành phố Hồ Chí Minh', 'DHV', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Khoa học - Đại học Huế', 'HUSC', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học - Đại học Thái Nguyên', 'TNUS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học Sức khỏe - ĐHQG Thành phố Hồ Chí Minh', 'UHS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học Tự nhiên - ĐHQG Hà Nội', 'VNU-HUS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học Tự nhiên - ĐHQG Thành phố Hồ Chí Minh', 'HCMUS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học Xã hội và Nhân văn - ĐHQG Hà Nội', 'VNU-USSH', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Khoa học Xã hội và Nhân văn - ĐHQG Thành phố Hồ Chí Minh', 'HCMUSSH', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kiên Giang', 'KGU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kiến trúc Đà Nẵng', 'DAU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Kiến trúc Hà Nội', 'HAU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kiến trúc Thành phố Hồ Chí Minh', 'UAH', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh Bắc', 'UKB', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Kinh doanh và Công nghệ Hà Nội', 'HUBT', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Kinh tế - Đại học Đà Nẵng', 'DUE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh tế - Đại học Huế', 'HCE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh tế - ĐHQG Hà Nội', 'VNU-UEB', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh tế - Kỹ thuật Bình Dương', 'BETU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Kinh tế - Kỹ thuật Công nghiệp', 'UNETI', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh tế - Luật - ĐHQG Thành phố Hồ Chí Minh', 'UEL', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kinh tế - Tài chính Thành phố Hồ Chí Minh', 'UEF', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Kinh tế và Quản trị Kinh doanh - Đại học Thái Nguyên', 'TUEBA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Kỹ thuật Công nghiệp - Đại học Thái Nguyên', 'TNUT', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Lạc Hồng', 'LHU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Lao động - Xã hội', 'ULSA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Luật - Đại học Huế', 'HUL', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Luật - ĐHQG Hà Nội', 'VNU-UL', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Luật Hà Nội', 'HLU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Luật Thành phố Hồ Chí Minh', 'ULAW', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Mỏ - Địa chất', 'HUMG', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Mở Hà Nội', 'HOU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Mở Thành phố Hồ Chí Minh', 'HCMOU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Mỹ thuật Công nghiệp', 'UAD', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Mỹ thuật Việt Nam', 'VNUFA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nam Cần Thơ', 'DNC', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Nghệ thuật - Đại học Huế', 'HUFA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Ngoại ngữ - Đại học Đà Nẵng', 'UFLS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Ngoại ngữ - Đại học Huế', 'HUFLIS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Ngoại ngữ - ĐHQG Hà Nội', 'VNU-ULIS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Ngoại ngữ - Tin học Thành phố Hồ Chí Minh', 'HUFLIT', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Ngoại thương', 'FTU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nguyễn Tất Thành', 'NTTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Nguyễn Trãi', 'NTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Nha Trang', 'NTU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nội vụ Hà Nội', 'HUHA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nông Lâm - Đại học Huế', 'HUAF', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nông Lâm - Đại học Thái Nguyên', 'TUAF', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Nông Lâm Thành phố Hồ Chí Minh', 'NLU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Phan Châu Trinh', 'PCTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Phenikaa', 'Phenikaa', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Phú Xuân', 'PXU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Phú Yên', 'PYU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Quang Trung', 'QTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Quốc tế Bắc Hà', 'BHIU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Quốc tế - ĐHQG Thành phố Hồ Chí Minh', 'IU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Quốc tế Hồng Bàng', 'HIU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Quốc tế Miền Đông', 'EIU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Quốc tế Sài Gòn', 'SIU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Quy Nhơn', 'QNU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sài Gòn', 'SGU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sân khấu - Điện ảnh Hà Nội', 'SKDA', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm - Đại học Đà Nẵng', 'UED', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm - Đại học Huế', 'HUCEd', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm - Đại học Thái Nguyên', 'TNUE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Hà Nội', 'HNUE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Kỹ thuật - Đại học Đà Nẵng', 'UTE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Kỹ thuật Thành phố Hồ Chí Minh', 'HCMUTE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Nghệ thuật Trung ương', 'NUAE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Thành phố Hồ Chí Minh', 'HCMUE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Thể dục Thể thao Hà Nội', 'HUPES', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Sư phạm Thể dục Thể thao Thành phố Hồ Chí Minh', 'UPES', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Tài chính - Marketing', 'UFM', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Tài chính - Ngân hàng Hà Nội', 'FBU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Tài nguyên và Môi trường Thành phố Hồ Chí Minh', 'HCMUNRE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Tân Trào', 'TQU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Tây Bắc', 'UTB', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Tây Đô', 'TDU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Tây Nguyên', 'TNU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Thăng Long', 'TLU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Thành Đô', 'TDU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Thương mại', 'TMU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Thủy lợi', 'TLU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Trà Vinh', 'TVU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Văn Hiến', 'VHU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Văn hóa Hà Nội', 'HUC', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Văn hóa Thành phố Hồ Chí Minh', 'HCMUC', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Văn Lang', 'VLU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Việt Đức', 'VGU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Vinh', 'VinhUni', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học VinUni', 'VinUni', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Võ Trường Toản', 'VTTU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Đại học Xây dựng Hà Nội', 'HUCE', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y - Dược - Đại học Huế', 'HUMP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y - Dược - Đại học Thái Nguyên', 'TUMP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y Dược - ĐHQG Hà Nội', 'VNU-UMP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y Dược Hải Phòng', 'HPMU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y Dược Thái Bình', 'TBUMP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y Dược Thành phố Hồ Chí Minh', 'UMP', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y Hà Nội', 'HMU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y khoa Phạm Ngọc Thạch', 'PNTU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Y tế Công cộng', 'HUPH', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Đại học Yersin Đà Lạt', 'YDU', 'UNIVERSITY', 'PRIVATE'),
    ('Trường Du lịch - Đại học Huế', 'HTU', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Quản trị và Kinh doanh - ĐHQG Hà Nội', 'HSB', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Quốc tế - ĐHQG Hà Nội', 'VNU-IS', 'UNIVERSITY', 'PUBLIC'),
    ('Trường Cao đẳng Bách Việt', 'BVC', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Cần Thơ', 'CTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Cơ điện Hà Nội', 'HCEM', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Cộng đồng Hà Nội', 'HNCC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Cộng đồng Hà Tây', 'HTCC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Công nghệ Quốc tế LILAMA 2', 'LILAMA2', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Công nghệ thông tin iSPACE', 'iSPACE', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Công nghệ Thủ Đức', 'TDC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Công Thương Thành phố Hồ Chí Minh', 'HITC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Đại Việt Sài Gòn', 'DVSG', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Dầu khí', 'PV College', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Du lịch Cần Thơ', 'CTTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Du lịch Đà Nẵng', 'DVTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Du lịch Hà Nội', 'HTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Du lịch Huế', 'HUETC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Du lịch Nha Trang', 'NTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Giao thông Vận tải Trung ương I', 'CCT1', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Giao thông Vận tải Trung ương III', 'CCT3', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Giao thông Vận tải Trung ương VI', 'CCT6', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Kinh tế Đối ngoại', 'COFER', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Kinh tế Thành phố Hồ Chí Minh', 'HCE', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Kỹ nghệ II', 'HVCT', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Kỹ thuật Cao Thắng', 'CTC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng nghề Công nghệ cao Hà Nội', 'HHT', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng nghề Du lịch Sài Gòn', 'STC', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Sư phạm Trung ương', 'NCE', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Sư phạm Trung ương Nha Trang', 'NCE-NhaTrang', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Sư phạm Trung ương Thành phố Hồ Chí Minh', 'NCE-HCM', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Y Dược Pasteur', 'Pasteur College', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Y Dược Sài Gòn', 'SYP', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Y khoa Phạm Ngọc Thạch', 'PNTC', 'COLLEGE', 'PRIVATE'),
    ('Trường Cao đẳng Y tế Cần Thơ', 'CTMC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Y tế Hà Nội', 'HMC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Y tế Hải Phòng', 'HPMC', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Y tế Huế', 'HMC-Hue', 'COLLEGE', 'PUBLIC'),
    ('Trường Cao đẳng Y tế Long An', 'LAYC', 'COLLEGE', 'PUBLIC'),
    ('Trường Trung cấp Công nghệ Thăng Long', 'TLTC', 'VOCATIONAL_SECONDARY', NULL),
    ('Trường Trung cấp Du lịch và Khách sạn Saigontourist', 'STHC', 'VOCATIONAL_SECONDARY', 'PUBLIC'),
    ('Trường Trung cấp Kinh tế - Kỹ thuật Bắc Thăng Long', 'BTLTC', 'VOCATIONAL_SECONDARY', NULL),
    ('Trường Trung cấp Kinh tế - Kỹ thuật Nguyễn Hữu Cảnh', 'NHCTC', 'VOCATIONAL_SECONDARY', 'PUBLIC'),
    ('Trường Trung cấp Y Dược Tuệ Tĩnh Hà Nội', 'TTYDHN', 'VOCATIONAL_SECONDARY', NULL),
    ('Trường Đại học Anh Quốc Việt Nam', 'BUV', 'UNIVERSITY', 'FOREIGN_INVESTED'),
    ('Trường Đại học RMIT Việt Nam', 'RMIT Vietnam', 'UNIVERSITY', 'FOREIGN_INVESTED');
